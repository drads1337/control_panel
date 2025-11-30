r#include <EGL/egl.h>
#include <GLES3/gl3.h>
#include "imgui.h"
#include "backends/imgui_impl_android.h"
#include "backends/imgui_impl_opengl3.h"
#include <android/native_activity.h>
#include <android/log.h>
#include <jni.h>
#include <string>
#include <iostream>
#include <algorithm>
#include <cctype>
#include "LOGIN/StrEnc.h"
#include <android/input.h>
#include <android/keycodes.h>
#include "LOGIN/json.hpp"
#include <android_native_app_glue.h>
#include "LOGIN/Login.h"

#include <openssl/evp.h>
#include <openssl/rand.h>
#include <openssl/err.h>
#include <openssl/hmac.h>
#include <curl/curl.h>
#include <vector>
#include <cstring>
#include <cstdio>
#include <sstream>
#include <iomanip>
#include <stdexcept>
#include <memory>
#include <iterator>
#include <openssl/bio.h>
#include <openssl/buffer.h>
#include <random>
#include <fstream>
#include "LOGIN/cpr/cpr.h"
#include <ctime>
#include <openssl/x509.h>
#include <openssl/pem.h>
#include <openssl/ssl.h>

#define LOGI(...) __android_log_print(ANDROID_LOG_INFO, "CheckLicense", __VA_ARGS__)
#define LOGE(...) __android_log_print(ANDROID_LOG_ERROR, "CheckLicense", __VA_ARGS__)

using json = nlohmann::json;

// --- CONFIGURATION ---
constexpr const char* SERVER_URL = "http://192.168.1.7:5001";
const std::string MASTER_KEY = "e1bfbd3b06772c0b488917f66de63ec9e7a9244b70f228048434eafeb0160801";
std::string g_ProjectId = "4";
extern std::string g_gameName;

// --- GLOBALS ---
android_app *g_App = 0;
std::string g_Token;
std::string g_lastDecryptedResponse;
std::string g_lastFingerprint;
std::string g_OfflineTicket;
std::string g_OfflineTicketUserKey;

// Product info from connect response
struct ProductInfo {
    int id;
    std::string unique_id;
    std::string name;
    std::string description;
    std::string version;
    std::string logo;  // Server path
    std::string banner;  // Server path
    std::string background;  // Server path
    std::string file;  // Server path
    // Local paths after download
    std::string logo_local;
    std::string banner_local;
    std::string background_local;
    std::string file_local;
};
ProductInfo g_ProductInfo;

// --- EGL SETUP ---
#ifndef EGL_OPENGL_ES3_BIT_KHR
#define EGL_OPENGL_ES3_BIT_KHR 0x00000040
#endif

struct EGLObjects {
    EGLDisplay display = EGL_NO_DISPLAY;
    EGLSurface surface = EGL_NO_SURFACE;
    EGLContext context = EGL_NO_CONTEXT;
};

static EGLObjects init_egl(ANativeWindow* window) {
    EGLObjects egl;
    EGLint majorVersion = 0, minorVersion = 0;
    EGLConfig config = nullptr;
    EGLint numConfigs = 0;
    const char* LOG_TAG = "ImGuiLoginEGL";

    const EGLint configAttribsGLES3[] = {
            EGL_RENDERABLE_TYPE, EGL_OPENGL_ES3_BIT_KHR,
            EGL_SURFACE_TYPE, EGL_WINDOW_BIT,
            EGL_BLUE_SIZE, 8, EGL_GREEN_SIZE, 8, EGL_RED_SIZE, 8, EGL_DEPTH_SIZE, 16,
            EGL_NONE
    };
    const EGLint contextAttribsGLES3[] = { EGL_CONTEXT_CLIENT_VERSION, 3, EGL_NONE };
    const EGLint configAttribsGLES2[] = {
            EGL_RENDERABLE_TYPE, EGL_OPENGL_ES2_BIT,
            EGL_SURFACE_TYPE, EGL_WINDOW_BIT,
            EGL_BLUE_SIZE, 8, EGL_GREEN_SIZE, 8, EGL_RED_SIZE, 8, EGL_DEPTH_SIZE, 16,
            EGL_NONE
    };
    const EGLint contextAttribsGLES2[] = { EGL_CONTEXT_CLIENT_VERSION, 2, EGL_NONE };

    egl.display = eglGetDisplay(EGL_DEFAULT_DISPLAY);
    if (egl.display == EGL_NO_DISPLAY) return egl;
    if (!eglInitialize(egl.display, &majorVersion, &minorVersion)) return egl;

    if (eglChooseConfig(egl.display, configAttribsGLES3, &config, 1, &numConfigs) && numConfigs > 0) {
        egl.surface = eglCreateWindowSurface(egl.display, config, window, nullptr);
        egl.context = eglCreateContext(egl.display, config, EGL_NO_CONTEXT, contextAttribsGLES3);
        if (egl.surface != EGL_NO_SURFACE && egl.context != EGL_NO_CONTEXT) {
            eglMakeCurrent(egl.display, egl.surface, egl.surface, egl.context);
            return egl;
        }
    }
    // Fallback to ES2
    if (eglChooseConfig(egl.display, configAttribsGLES2, &config, 1, &numConfigs) && numConfigs > 0) {
        egl.surface = eglCreateWindowSurface(egl.display, config, window, nullptr);
        egl.context = eglCreateContext(egl.display, config, EGL_NO_CONTEXT, contextAttribsGLES2);
        if (egl.surface != EGL_NO_SURFACE && egl.context != EGL_NO_CONTEXT) {
            eglMakeCurrent(egl.display, egl.surface, egl.surface, egl.context);
            return egl;
        }
    }
    return egl;
}

static void terminate_egl(EGLObjects& egl) {
    if (egl.display != EGL_NO_DISPLAY) {
        eglMakeCurrent(egl.display, EGL_NO_SURFACE, EGL_NO_SURFACE, EGL_NO_CONTEXT);
        if (egl.context != EGL_NO_CONTEXT) eglDestroyContext(egl.display, egl.context);
        if (egl.surface != EGL_NO_SURFACE) eglDestroySurface(egl.display, egl.surface);
        eglTerminate(egl.display);
    }
    egl.display = EGL_NO_DISPLAY;
    egl.context = EGL_NO_CONTEXT;
    egl.surface = EGL_NO_SURFACE;
}

// --- JNI HELPER FUNCTIONS ---

std::string GetClipboardText(android_app* app) {
    JNIEnv* env = nullptr;
    std::string result;
    app->activity->vm->AttachCurrentThread(&env, nullptr);

    do {
        jclass contextClass = env->FindClass("android/content/Context");
        if (!contextClass) break;
        jmethodID getSystemService = env->GetMethodID(contextClass, "getSystemService", "(Ljava/lang/String;)Ljava/lang/Object;");
        if (!getSystemService) break;
        jfieldID clipboardServiceField = env->GetStaticFieldID(contextClass, "CLIPBOARD_SERVICE", "Ljava/lang/String;");
        jstring clipboardServiceName = (jstring)env->GetStaticObjectField(contextClass, clipboardServiceField);

        jobject clipboardManager = env->CallObjectMethod(app->activity->clazz, getSystemService, clipboardServiceName);
        if (env->ExceptionCheck() || !clipboardManager) break;
        jclass clipboardManagerClass = env->FindClass("android/content/ClipboardManager");
        jmethodID getPrimaryClip = env->GetMethodID(clipboardManagerClass, "getPrimaryClip", "()Landroid/content/ClipData;");
        jobject clip = env->CallObjectMethod(clipboardManager, getPrimaryClip);
        if (env->ExceptionCheck() || !clip) break;

        jclass clipDataClass = env->FindClass("android/content/ClipData");
        jmethodID getItemAt = env->GetMethodID(clipDataClass, "getItemAt", "(I)Landroid/content/ClipData$Item;");
        jobject item = env->CallObjectMethod(clip, getItemAt, 0);
        if (env->ExceptionCheck() || !item) break;

        jclass itemClass = env->FindClass("android/content/ClipData$Item");
        jmethodID getText = env->GetMethodID(itemClass, "getText", "()Ljava/lang/CharSequence;");
        jobject text = env->CallObjectMethod(item, getText);
        if (env->ExceptionCheck() || !text) break;

        jclass charSequenceClass = env->FindClass("java/lang/CharSequence");
        jmethodID toString = env->GetMethodID(charSequenceClass, "toString", "()Ljava/lang/String;");
        jstring textStr = (jstring)env->CallObjectMethod(text, toString);
        if (env->ExceptionCheck() || !textStr) break;

        const char* textChars = env->GetStringUTFChars(textStr, nullptr);
        result = textChars;
        env->ReleaseStringUTFChars(textStr, textChars);
    } while (false);

    if (env && env->ExceptionCheck()) env->ExceptionClear();
    if (app && app->activity && app->activity->vm) app->activity->vm->DetachCurrentThread();
    return result;
}

// Obfuscated string helpers would go here. Using plain strings for readability in this version.
jstring GetAndroidID(JNIEnv *env, jobject context) {
    jclass contextClass = env->FindClass("android/content/Context");
    jmethodID getContentResolverMethod = env->GetMethodID(contextClass, "getContentResolver", "()Landroid/content/ContentResolver;");
    jclass settingSecureClass = env->FindClass("android/provider/Settings$Secure");
    jmethodID getStringMethod = env->GetStaticMethodID(settingSecureClass, "getString", "(Landroid/content/ContentResolver;Ljava/lang/String;)Ljava/lang/String;");
    auto obj = env->CallObjectMethod(context, getContentResolverMethod);
    return (jstring) env->CallStaticObjectMethod(settingSecureClass, getStringMethod, obj, env->NewStringUTF("android_id"));
}

jstring GetDeviceModel(JNIEnv *env) {
    jclass buildClass = env->FindClass("android/os/Build");
    jfieldID modelId = env->GetStaticFieldID(buildClass, "MODEL", "Ljava/lang/String;");
    return (jstring) env->GetStaticObjectField(buildClass, modelId);
}

jstring GetDeviceBrand(JNIEnv *env) {
    jclass buildClass = env->FindClass("android/os/Build");
    jfieldID brandId = env->GetStaticFieldID(buildClass, "BRAND", "Ljava/lang/String;");
    return (jstring) env->GetStaticObjectField(buildClass, brandId);
}

// --- CRYPTO UTILS ---

std::string md5(const std::string& str) {
    unsigned char digest[MD5_DIGEST_LENGTH];
    MD5((const unsigned char*)str.c_str(), str.size(), digest);
    char mdString[33];
    for (int i = 0; i < 16; ++i) sprintf(&mdString[i * 2], "%02x", (unsigned int)digest[i]);
    return std::string(mdString);
}

std::string sha256(const std::string& str) {
    unsigned char hash[32];
    EVP_MD_CTX* ctx = EVP_MD_CTX_new();
    EVP_DigestInit_ex(ctx, EVP_sha256(), nullptr);
    EVP_DigestUpdate(ctx, str.c_str(), str.size());
    EVP_DigestFinal_ex(ctx, hash, nullptr);
    EVP_MD_CTX_free(ctx);
    char buf[65];
    for (int i = 0; i < 32; ++i) sprintf(buf + i * 2, "%02x", hash[i]);
    buf[64] = 0;
    return std::string(buf);
}

std::string random_hex(size_t length) {
    static std::random_device rd;
    static std::mt19937 gen(rd());
    static std::uniform_int_distribution<> dis(0, 15);
    std::ostringstream oss;
    for (size_t i = 0; i < length; ++i) oss << std::hex << std::nouppercase << dis(gen);
    return oss.str();
}

std::string base64_encode(const std::vector<unsigned char>& data) {
    BIO *bio, *b64;
    BUF_MEM *bufferPtr;
    b64 = BIO_new(BIO_f_base64());
    bio = BIO_new(BIO_s_mem());
    b64 = BIO_push(b64, bio);
    BIO_set_flags(b64, BIO_FLAGS_BASE64_NO_NL);
    BIO_write(b64, data.data(), data.size());
    BIO_flush(b64);
    BIO_get_mem_ptr(b64, &bufferPtr);
    std::string result(bufferPtr->data, bufferPtr->length);
    BIO_free_all(b64);
    return result;
}

std::vector<unsigned char> base64_decode(const std::string& encoded) {
    BIO *bio, *b64;
    int decodeLen = encoded.size();
    std::vector<unsigned char> buffer(decodeLen);
    b64 = BIO_new(BIO_f_base64());
    bio = BIO_new_mem_buf(encoded.data(), encoded.size());
    b64 = BIO_push(b64, bio);
    BIO_set_flags(b64, BIO_FLAGS_BASE64_NO_NL);
    int len = BIO_read(b64, buffer.data(), buffer.size());
    buffer.resize(len);
    BIO_free_all(b64);
    return buffer;
}

std::string encrypt_with_master_key(const std::string& plaintext, const std::string& master_key_hex) {
    try {
        std::vector<unsigned char> key;
        for (size_t i = 0; i < master_key_hex.length(); i += 2) {
            key.push_back(static_cast<unsigned char>(std::stoul(master_key_hex.substr(i, 2), nullptr, 16)));
        }
        std::vector<unsigned char> iv(12);
        RAND_bytes(iv.data(), iv.size());

        EVP_CIPHER_CTX* ctx = EVP_CIPHER_CTX_new();
        std::vector<unsigned char> ciphertext(plaintext.size() + 32);
        int len, ciphertext_len;

        EVP_EncryptInit_ex(ctx, EVP_aes_256_gcm(), NULL, NULL, NULL);
        EVP_CIPHER_CTX_ctrl(ctx, EVP_CTRL_GCM_SET_IVLEN, 12, NULL);
        EVP_EncryptInit_ex(ctx, NULL, NULL, key.data(), iv.data());
        EVP_EncryptUpdate(ctx, ciphertext.data(), &len, (unsigned char*)plaintext.data(), plaintext.size());
        ciphertext_len = len;
        EVP_EncryptFinal_ex(ctx, ciphertext.data() + len, &len);
        ciphertext_len += len;

        std::vector<unsigned char> tag(16);
        EVP_CIPHER_CTX_ctrl(ctx, EVP_CTRL_GCM_GET_TAG, 16, tag.data());
        EVP_CIPHER_CTX_free(ctx);

        std::vector<unsigned char> combined(iv);
        combined.insert(combined.end(), ciphertext.begin(), ciphertext.begin() + ciphertext_len);
        combined.insert(combined.end(), tag.begin(), tag.end());

        return base64_encode(combined);
    } catch (...) { return ""; }
}

std::string decrypt_with_master_key(const std::string& encrypted_data_b64, const std::string& master_key_hex) {
    try {
        std::vector<unsigned char> decoded = base64_decode(encrypted_data_b64);
        if (decoded.size() < 28) throw std::runtime_error("Data too short");

        std::vector<unsigned char> key;
        for (size_t i = 0; i < master_key_hex.length(); i += 2) {
            key.push_back(static_cast<unsigned char>(std::stoul(master_key_hex.substr(i, 2), nullptr, 16)));
        }

        std::vector<unsigned char> iv(decoded.begin(), decoded.begin() + 12);
        std::vector<unsigned char> tag(decoded.end() - 16, decoded.end());
        std::vector<unsigned char> ciphertext(decoded.begin() + 12, decoded.end() - 16);

        EVP_CIPHER_CTX* ctx = EVP_CIPHER_CTX_new();
        std::vector<unsigned char> plaintext(ciphertext.size() + 32);
        int len, plaintext_len;

        EVP_DecryptInit_ex(ctx, EVP_aes_256_gcm(), NULL, NULL, NULL);
        EVP_CIPHER_CTX_ctrl(ctx, EVP_CTRL_GCM_SET_IVLEN, 12, NULL);
        EVP_DecryptInit_ex(ctx, NULL, NULL, key.data(), iv.data());
        EVP_DecryptUpdate(ctx, plaintext.data(), &len, ciphertext.data(), ciphertext.size());
        plaintext_len = len;
        EVP_CIPHER_CTX_ctrl(ctx, EVP_CTRL_GCM_SET_TAG, 16, tag.data());

        if (EVP_DecryptFinal_ex(ctx, plaintext.data() + len, &len) != 1) {
            EVP_CIPHER_CTX_free(ctx);
            throw std::runtime_error("Auth failed");
        }
        plaintext_len += len;
        EVP_CIPHER_CTX_free(ctx);
        plaintext.resize(plaintext_len);

        return std::string(plaintext.begin(), plaintext.end());
    } catch (...) { throw; }
}

// --- OFFLINE TICKET FUNCTIONS ---

std::string GetOfflineTicketPath() {
    return "/sdcard/Download/offline_ticket.txt";
}

void SaveOfflineTicket(const std::string& ticket, const std::string& user_key, const std::string& fingerprint) {
    try {
        std::ofstream file(GetOfflineTicketPath(), std::ios::binary);
        if (file.is_open()) {
            json data;
            data["ticket"] = ticket;
            data["user_key"] = user_key;
            data["fingerprint"] = fingerprint;
            data["saved_at"] = std::time(nullptr);
            file << data.dump();
            file.close();
            LOGI("Offline ticket saved to %s", GetOfflineTicketPath().c_str());
        } else {
            LOGE("Failed to save offline ticket: cannot open file");
        }
    } catch (const std::exception& e) {
        LOGE("Error saving offline ticket: %s", e.what());
    }
}

bool LoadOfflineTicket() {
    try {
        std::ifstream file(GetOfflineTicketPath());
        if (file.is_open()) {
            std::string content((std::istreambuf_iterator<char>(file)), std::istreambuf_iterator<char>());
            file.close();
            
            if (content.empty()) {
                return false;
            }
            
            json data = json::parse(content);
            if (data.contains("ticket") && data.contains("user_key") && data.contains("fingerprint")) {
                g_OfflineTicket = data["ticket"].get<std::string>();
                g_OfflineTicketUserKey = data["user_key"].get<std::string>();
                g_lastFingerprint = data["fingerprint"].get<std::string>();
                LOGI("Offline ticket loaded: user_key=%s", g_OfflineTicketUserKey.c_str());
                return true;
            }
        }
    } catch (const std::exception& e) {
        LOGE("Error loading offline ticket: %s", e.what());
    }
    return false;
}

std::vector<unsigned char> base64url_decode(const std::string& encoded) {
    std::string base64_encoded = encoded;
    std::replace(base64_encoded.begin(), base64_encoded.end(), '-', '+');
    std::replace(base64_encoded.begin(), base64_encoded.end(), '_', '/');
    
    while (base64_encoded.length() % 4 != 0) {
        base64_encoded += "=";
    }
    
    return base64_decode(base64_encoded);
}

bool ValidateOfflineTicket(const std::string& ticket, const std::string& current_fingerprint) {
    if (ticket.empty()) return false;
    
    size_t dot1 = ticket.find('.');
    size_t dot2 = ticket.find('.', dot1 + 1);
    if (dot1 == std::string::npos || dot2 == std::string::npos) {
        LOGE("Invalid JWT format");
        return false;
    }
    
    try {
        std::string payload_b64url = ticket.substr(dot1 + 1, dot2 - dot1 - 1);
        
        std::vector<unsigned char> payload_bytes = base64url_decode(payload_b64url);
        std::string payload_str(payload_bytes.begin(), payload_bytes.end());
        json payload = json::parse(payload_str);

        if (payload.contains("exp")) {
            int64_t exp = payload["exp"].get<int64_t>();
            int64_t now = std::time(nullptr);
            if (now >= exp) {
                LOGE("Offline ticket expired: exp=%lld, now=%lld", exp, now);
                return false;
            }
        }
        
        // Проверяем fingerprint
        if (payload.contains("fid")) {
            std::string fid = payload["fid"].get<std::string>();
            if (fid != current_fingerprint) {
                LOGE("Offline ticket fingerprint mismatch: expected=%s, got=%s", current_fingerprint.c_str(), fid.c_str());
                return false;
            }
        }
        
        LOGI("Offline ticket is valid");
        return true;
    } catch (const std::exception& e) {
        LOGE("Error validating offline ticket: %s", e.what());
        return false;
    }
}

// Попытка использовать offline_ticket для офлайн входа
std::string TryOfflineLogin(const std::string& user_key, const std::string& fingerprint) {
    if (g_OfflineTicket.empty()) {
        if (!LoadOfflineTicket()) {
            return "Error: No offline ticket found";
        }
    }
    
    // Проверяем, что user_key совпадает
    if (g_OfflineTicketUserKey != user_key) {
        LOGI("Offline ticket user key mismatch: expected=%s, got=%s", g_OfflineTicketUserKey.c_str(), user_key.c_str());
        return "Error: Offline ticket user key mismatch";
    }
    
    // Проверяем валидность offline_ticket
    if (!ValidateOfflineTicket(g_OfflineTicket, fingerprint)) {
        return "Error: Offline ticket is invalid or expired";
    }
    
    // Устанавливаем токен (используем offline_ticket как токен для офлайн режима)
    // В офлайн режиме мы используем сам offline_ticket как токен
    g_Token = g_OfflineTicket;
    LOGI("Offline login successful with ticket for user_key=%s", user_key.c_str());
    return "VALID|Offline|Offline mode";
}

// --- NETWORK API CALLS ---

std::string DownloadProductFile(const std::string& product_id, const std::string& file_type, const std::string& file_name);

std::string GetChallenge(const std::string& user_key, const std::string& fingerprint) {
    cpr::Session session;
    session.SetUrl(std::string(SERVER_URL) + "/api/challenge");
    session.SetHeader({{"Content-Type", "application/json"}});
    session.SetTimeout(cpr::Timeout{10000});
    session.SetSslOptions(cpr::Ssl(cpr::ssl::TLSv1_2{}, cpr::ssl::VerifyHost{false}, cpr::ssl::VerifyPeer{false}));

    json challenge_data;
    challenge_data["user_key"] = user_key;
    challenge_data["fingerprint"] = fingerprint;
    challenge_data["project_id"] = g_ProjectId;
    session.SetBody(cpr::Body{challenge_data.dump()});

    cpr::Response response = session.Post();

    if (response.status_code == 200) {
        try {
            json result = json::parse(response.text);
            std::string canary = result["canary"];
            std::string challenge;

            if (result.contains("challenge") && result["challenge"].is_object()) {
                auto crypto_challenges = result["challenge"]["challenges"]["crypto"]["challenges"];
                if (crypto_challenges.contains("sha256")) challenge = crypto_challenges["sha256"]["input"];
                else if (crypto_challenges.contains("combined")) challenge = crypto_challenges["combined"]["input"];
                else return "";
            } else if (result.contains("challenge") && result["challenge"].is_string()) {
                challenge = result["challenge"];
            }

            if (result.contains("project_id")) g_ProjectId = std::to_string(result["project_id"].get<int>());
            return challenge + "|" + canary;
        } catch (...) { return ""; }
    }
    return "";
}

std::string ConnectWithChallenge(const std::string& user_key, const std::string& challenge_data,
                                 const std::string& fingerprint, const std::string& game_name,
                                 const std::string& serial, const std::string& android_id,
                                 const std::string& device_model, const std::string& device_brand) {
    size_t separator = challenge_data.find("|");
    if (separator == std::string::npos) return "Error: Invalid challenge format";

    std::string challenge = challenge_data.substr(0, separator);
    std::string canary = challenge_data.substr(separator + 1);

    std::string challenge_response;
    if (challenge.length() > 100) challenge_response = sha256(challenge);
    else challenge_response = sha256(challenge + user_key + fingerprint);

    json data;
    data["a"] = user_key;
    data["b"] = challenge_response;
    data["c"] = canary;
    data["d"] = fingerprint;
    data["e"] = game_name;
    data["f"] = serial;
    data["g"] = android_id;
    data["h"] = device_model;
    data["i"] = device_brand;
    data["j"] = random_hex(16);
    data["k"] = g_ProjectId;

    cpr::Session session;
    session.SetUrl(std::string(SERVER_URL) + "/api/connect");
    session.SetHeader({{"Content-Type", "application/json"}});
    session.SetTimeout(cpr::Timeout{10000});
    session.SetSslOptions(cpr::Ssl(cpr::ssl::TLSv1_2{}, cpr::ssl::VerifyHost{false}, cpr::ssl::VerifyPeer{false}));

    json request_data;
    request_data["blob"] = encrypt_with_master_key(data.dump(), MASTER_KEY);
    session.SetBody(cpr::Body{request_data.dump()});

    cpr::Response response = session.Post();

    if (response.status_code == 200) {
        try {
            std::string decrypted = decrypt_with_master_key(response.text, MASTER_KEY);
            g_lastDecryptedResponse = decrypted;
            json result = json::parse(decrypted);

            if (result.contains("error")) return "Server Error: " + result["error"].get<std::string>();

            if (result.contains("a") && result.contains("d") && result.contains("f")) {
                // Prefer JWT access_token for API authentication, fallback to connect token
                if (result.contains("access_token") && result["access_token"].is_string()) {
                    g_Token = result["access_token"].get<std::string>();
                } else {
                    // Fallback to legacy connect token (concatenated a, d, f)
                    g_Token = std::string(result["a"]) + std::string(result["d"]) + std::string(result["f"]);
                }
                if (result.contains("project_id")) g_ProjectId = std::to_string(result["project_id"].get<int>());

                // Извлекаем информацию о продукте из ответа connect
                if (result.contains("product") && result["product"].is_object()) {
                    auto product = result["product"];
                    g_ProductInfo.id = product.value("id", 0);
                    g_ProductInfo.unique_id = product.value("unique_id", "");
                    g_ProductInfo.name = product.value("name", "");
                    g_ProductInfo.description = product.value("description", "");
                    g_ProductInfo.version = product.value("version", "1.0.0");
                    g_ProductInfo.logo = product.value("logo", "");
                    g_ProductInfo.banner = product.value("banner", "");
                    g_ProductInfo.background = product.value("background", "");
                    g_ProductInfo.file = product.value("file", "");
                    
                    // Скачиваем файлы продукта
                    if (!g_ProductInfo.unique_id.empty() || g_ProductInfo.id > 0) {
                        std::string product_id = g_ProductInfo.unique_id.empty() ? std::to_string(g_ProductInfo.id) : g_ProductInfo.unique_id;
                        // Скачиваем logo, banner, background и file через API
                        if (!g_ProductInfo.logo.empty()) {
                            g_ProductInfo.logo_local = DownloadProductFile(product_id, "logo", "logo");
                        }
                        if (!g_ProductInfo.banner.empty()) {
                            g_ProductInfo.banner_local = DownloadProductFile(product_id, "banner", "banner");
                        }
                        if (!g_ProductInfo.background.empty()) {
                            g_ProductInfo.background_local = DownloadProductFile(product_id, "background", "background");
                        }
                        if (!g_ProductInfo.file.empty()) {
                            g_ProductInfo.file_local = DownloadProductFile(product_id, "agent", "file");
                        }
                    }
                }

                // Извлекаем уведомления из ответа connect
                if (result.contains("notifications") && result["notifications"].is_array()) {
                    g_notifications.clear();
                    for (const auto& item : result["notifications"]) {
                        Notification notif;
                        notif.id = item.value("id", 0);
                        notif.message = item.value("message", "");
                        if (item.contains("title") && !item["title"].get<std::string>().empty()) {
                            notif.message = item["title"].get<std::string>() + ": " + notif.message;
                        }
                        notif.type = item.value("type", "info");
                        notif.is_read = false; // Уведомления из connect помечаются как прочитанные на сервере
                        notif.created_at = item.value("created_at", "");
                        notif.repeat_count = 0;
                        notif.show_count = 0;
                        g_notifications.push_back(notif);
                    }
                    g_notificationsLoaded = true;
                }

                // Сохраняем offline_ticket если он есть в ответе
                if (result.contains("offline_ticket") && result["offline_ticket"].is_string()) {
                    g_OfflineTicket = result["offline_ticket"].get<std::string>();
                    g_OfflineTicketUserKey = user_key;
                    SaveOfflineTicket(g_OfflineTicket, user_key, fingerprint);
                    LOGI("Offline ticket saved successfully");
                }

                std::string expires = result.value("expires_at", "Never");
                std::string left = result.value("seconds_left_human", "Unknown");
                return "VALID|" + expires + "|" + left;
            }
            return "Error: Invalid server response";
        } catch (const std::exception& e) { return "Decryption Error: " + std::string(e.what()); }
    }
    return "HTTP Error: " + std::to_string(response.status_code);
}

std::string CheckLicense(const char* user_key, const char* game_name, JNIEnv* env, jobject context, const char* extra_param) {
    if (!user_key || strlen(user_key) == 0) return "Error: License key cannot be empty";

    jstring aid = GetAndroidID(env, context);
    jstring dmodel = GetDeviceModel(env);
    jstring dbrand = GetDeviceBrand(env);

    const char* c_aid = env->GetStringUTFChars(aid, 0);
    const char* c_model = env->GetStringUTFChars(dmodel, 0);
    const char* c_brand = env->GetStringUTFChars(dbrand, 0);

    std::string android_id = c_aid ? c_aid : "unknown";
    std::string device_model = c_model ? c_model : "unknown";
    std::string device_brand = c_brand ? c_brand : "unknown";
    std::string fingerprint = sha256(android_id + "-" + device_model + "-" + device_brand);
    g_lastFingerprint = fingerprint;

    // Сначала пытаемся использовать offline_ticket если он есть
    if (g_OfflineTicket.empty()) {
        LoadOfflineTicket();
    }
    
    std::string offline_result = TryOfflineLogin(user_key, fingerprint);
    if (offline_result.find("VALID") == 0) {
        env->ReleaseStringUTFChars(aid, c_aid);
        env->ReleaseStringUTFChars(dmodel, c_model);
        env->ReleaseStringUTFChars(dbrand, c_brand);
        env->DeleteLocalRef(aid); env->DeleteLocalRef(dmodel); env->DeleteLocalRef(dbrand);
        return offline_result;
    }

    // Если offline_ticket не работает или его нет, пытаемся подключиться к серверу
    std::string challenge = GetChallenge(user_key, fingerprint);
    std::string result;

    if (challenge.empty()) {
        // Если не удалось получить challenge (нет интернета), пробуем использовать offline_ticket еще раз
        if (!g_OfflineTicket.empty() || LoadOfflineTicket()) {
            std::string offline_result2 = TryOfflineLogin(user_key, fingerprint);
            if (offline_result2.find("VALID") == 0) {
                env->ReleaseStringUTFChars(aid, c_aid);
                env->ReleaseStringUTFChars(dmodel, c_model);
                env->ReleaseStringUTFChars(dbrand, c_brand);
                env->DeleteLocalRef(aid); env->DeleteLocalRef(dmodel); env->DeleteLocalRef(dbrand);
                return offline_result2;
            }
        }
        result = "Error: Failed to obtain challenge. Check your internet connection.";
    } else {
        result = ConnectWithChallenge(user_key, challenge, fingerprint, game_name, android_id, android_id, device_model, device_brand);
    }

    env->ReleaseStringUTFChars(aid, c_aid);
    env->ReleaseStringUTFChars(dmodel, c_model);
    env->ReleaseStringUTFChars(dbrand, c_brand);
    env->DeleteLocalRef(aid); env->DeleteLocalRef(dmodel); env->DeleteLocalRef(dbrand);

    return result;
}

std::string LoginWithCredentials(const std::string& username, const std::string& password) {
    cpr::Session session;
    session.SetUrl(std::string(SERVER_URL) + "/api/auth/login");
    session.SetHeader({{"Content-Type", "application/json"}});
    session.SetTimeout(cpr::Timeout{10000});
    session.SetSslOptions(cpr::Ssl(cpr::ssl::TLSv1_2{}, cpr::ssl::VerifyHost{false}, cpr::ssl::VerifyPeer{false}));

    json body;
    body["username"] = username;
    body["password"] = password;
    session.SetBody(cpr::Body{body.dump()});

    cpr::Response response = session.Post();

    if (response.status_code == 200) {
        try {
            json result = json::parse(response.text);
            if (result.contains("access_token")) {
                g_Token = result["access_token"].get<std::string>();
                return "VALID|Login|OK";
            }
        } catch (...) {}
    }
    if (response.status_code == 401) return "Error: Invalid credentials";
    return "HTTP Error: " + std::to_string(response.status_code);
}

std::string RegisterAccount(const std::string& username, const std::string& password, const std::string& email) {
    cpr::Session session;
    session.SetUrl(std::string(SERVER_URL) + "/api/auth/register");
    session.SetHeader({{"Content-Type", "application/json"}});
    session.SetTimeout(cpr::Timeout{10000});
    session.SetSslOptions(cpr::Ssl(cpr::ssl::TLSv1_2{}, cpr::ssl::VerifyHost{false}, cpr::ssl::VerifyPeer{false}));

    json body;
    body["username"] = username;
    body["password"] = password;
    body["email"] = email;
    session.SetBody(cpr::Body{body.dump()});

    cpr::Response response = session.Post();
    if (response.status_code == 201) return "Success: Account created";

    try {
        json err = json::parse(response.text);
        if (err.contains("msg")) return "Error: " + err["msg"].get<std::string>();
    } catch (...) {}

    return "HTTP Error: " + std::to_string(response.status_code);
}

// --- UI DATA STRUCTURES ---

struct ImGuiToast {
    std::string message;
    std::string type;
    float duration, timeLeft;
    ImVec4 color;
    ImGuiToast(const std::string& msg, const std::string& t, float dur = 3.0f)
            : message(msg), type(t), duration(dur), timeLeft(dur) {
        if (type == "success") color = ImVec4(0.0f, 0.8f, 0.2f, 1.0f);
        else if (type == "warning") color = ImVec4(1.0f, 0.7f, 0.0f, 1.0f);
        else if (type == "error") color = ImVec4(0.9f, 0.2f, 0.2f, 1.0f);
        else color = ImVec4(0.2f, 0.6f, 1.0f, 1.0f);
    }
};

struct ChangelogEntry {
    std::string version, title, description, release_date;
    std::vector<std::string> changes;
    bool is_public;
};

struct Notification {
    int id;
    std::string message;
    std::string type;
    bool is_read;
    std::string created_at;
    int repeat_count;
    int show_count;
};

std::vector<ImGuiToast> g_toasts;
std::vector<ChangelogEntry> g_changelogEntries;
std::vector<Notification> g_notifications;
bool g_changelogLoaded = false;
bool g_notificationsLoaded = false;
bool g_showChangelog = false;
bool g_showNotifications = false;
bool g_showConfigDownloader = false;
bool g_showConfigUploader = false;

// --- UI HELPERS ---

void ShowImGuiToast(const std::string& message, const std::string& type = "info", float duration = 3.0f) {
    g_toasts.emplace_back(message, type, duration);
}

void RenderToasts() {
    ImGuiIO& io = ImGui::GetIO();
    float startY = 40.0f;
    // Responsive width: max 400px, or 90% of screen
    float toastWidth = std::min(io.DisplaySize.x * 0.9f, 400.0f);
    float startX = (io.DisplaySize.x - toastWidth) / 2.0f; // Center horizontally at top

    for (size_t i = 0; i < g_toasts.size();) {
        auto& toast = g_toasts[i];
        toast.timeLeft -= io.DeltaTime;
        if (toast.timeLeft <= 0) {
            g_toasts.erase(g_toasts.begin() + i);
            continue;
        }

        float alpha = std::min(1.0f, toast.timeLeft * 2.0f); // Fade out
        ImGui::SetNextWindowPos(ImVec2(startX, startY + i * 70.0f), ImGuiCond_Always);
        ImGui::SetNextWindowSize(ImVec2(toastWidth, 0.0f), ImGuiCond_Always);

        ImGui::PushStyleColor(ImGuiCol_WindowBg, ImVec4(0.1f, 0.1f, 0.12f, 0.95f * alpha));
        ImGui::PushStyleColor(ImGuiCol_Border, ImVec4(toast.color.x, toast.color.y, toast.color.z, alpha));
        ImGui::PushStyleVar(ImGuiStyleVar_WindowRounding, 8.0f);

        std::string title = "Info";
        if(toast.type == "error") title = "Error";
        else if(toast.type == "success") title = "Success";
        else if(toast.type == "warning") title = "Warning";

        if (ImGui::Begin(("Toast##" + std::to_string(i)).c_str(), nullptr,
                         ImGuiWindowFlags_NoTitleBar | ImGuiWindowFlags_NoResize | ImGuiWindowFlags_NoMove | ImGuiWindowFlags_NoScrollbar | ImGuiWindowFlags_NoInputs)) {

            ImGui::PushStyleColor(ImGuiCol_Text, ImVec4(toast.color.x, toast.color.y, toast.color.z, alpha));
            ImGui::Text("[%s]", title.c_str());
            ImGui::PopStyleColor();
            ImGui::SameLine();
            ImGui::TextWrapped("%s", toast.message.c_str());
            ImGui::End();
        }
        ImGui::PopStyleVar();
        ImGui::PopStyleColor(2);
        i++;
    }
}

void LoadChangelog() {
    if (g_changelogLoaded || g_Token.empty()) return;

    cpr::Session session;
    std::string game_name = g_gameName.empty() ? "default_game" : g_gameName;
    // Используем правильный endpoint: /api/changelog/products/{product_identifier}/changelog
    session.SetUrl(std::string(SERVER_URL) + "/api/changelog/products/" + game_name + "/changelog");
    session.SetHeader({{"Authorization", "Bearer " + g_Token}});
    session.SetSslOptions(cpr::Ssl(cpr::ssl::TLSv1_2{}, cpr::ssl::VerifyHost{false}, cpr::ssl::VerifyPeer{false}));

    auto response = session.Get();
    if (response.status_code == 200) {
        try {
            json data = json::parse(response.text);
            // API возвращает объект с полем "changelog"
            if (data.contains("changelog") && data["changelog"].is_array()) {
                data = data["changelog"];
            } else if (data.is_array()) {
                // Если уже массив, используем как есть
            } else {
                return;
            }

            g_changelogEntries.clear();
            for (const auto& item : data) {
                ChangelogEntry entry;
                entry.version = item.value("version", "");
                entry.title = item.value("title", "");
                entry.description = item.value("description", "");
                entry.release_date = item.value("release_date", "");
                entry.is_public = item.value("is_public", true);
                if (item.contains("changes") && item["changes"].is_array()) {
                    for (const auto& c : item["changes"]) entry.changes.push_back(c.get<std::string>());
                }
                g_changelogEntries.push_back(entry);
            }
            g_changelogLoaded = true;
        } catch (...) {}
    }
}

void LoadNotifications(bool unread_only = false) {
    // Для авторизации через лицензионный ключ уведомления уже загружены из ответа connect
    // Эта функция используется только для веб-авторизации (username/password) с JWT токеном
    if (g_Token.empty()) return;

    // Проверяем, является ли токен JWT (обычно JWT содержит точки)
    // Connect token - это 64-символьный hex, JWT содержит точки
    bool is_jwt = g_Token.find('.') != std::string::npos;
    
    if (!is_jwt) {
        // Это connect token, уведомления уже загружены из ответа connect
        return;
    }

    // Для JWT токена (веб-авторизация) используем API endpoint
    cpr::Session session;
    std::string url = std::string(SERVER_URL) + "/api/notifications";
    std::string query_params = "?per_page=50"; // Получаем до 50 уведомлений
    if (unread_only) {
        query_params += "&unread_only=true";
    }
    url += query_params;
    
    session.SetUrl(url);
    session.SetHeader({{"Authorization", "Bearer " + g_Token}});
    session.SetSslOptions(cpr::Ssl(cpr::ssl::TLSv1_2{}, cpr::ssl::VerifyHost{false}, cpr::ssl::VerifyPeer{false}));

    auto response = session.Get();
    if (response.status_code == 200) {
        try {
            json data = json::parse(response.text);
            if (data.contains("notifications") && data["notifications"].is_array()) {
                g_notifications.clear();
                for (const auto& item : data["notifications"]) {
                    Notification notif;
                    notif.id = item.value("id", 0);
                    notif.message = item.value("message", "");
                    notif.type = item.value("type", "info");
                    notif.is_read = item.value("is_read", false);
                    notif.created_at = item.value("created_at", "");
                    notif.repeat_count = item.value("repeat_count", 0);
                    notif.show_count = item.value("show_count", 0);
                    g_notifications.push_back(notif);
                }
                g_notificationsLoaded = true;
            }
        } catch (...) {}
    }
}

void MarkNotificationAsRead(int notification_id) {
    if (g_Token.empty()) return;

    // Проверяем, является ли токен JWT (для connect token эта функция не нужна)
    bool is_jwt = g_Token.find('.') != std::string::npos;
    if (!is_jwt) {
        // Для connect token просто помечаем локально как прочитанное
        for (auto& notif : g_notifications) {
            if (notif.id == notification_id) {
                notif.is_read = true;
                break;
            }
        }
        return;
    }

    // Для JWT токена отправляем запрос на сервер
    cpr::Session session;
    session.SetUrl(std::string(SERVER_URL) + "/api/notifications/" + std::to_string(notification_id) + "/read");
    session.SetHeader({{"Authorization", "Bearer " + g_Token}});
    session.SetSslOptions(cpr::Ssl(cpr::ssl::TLSv1_2{}, cpr::ssl::VerifyHost{false}, cpr::ssl::VerifyPeer{false}));

    auto response = session.Put();
    if (response.status_code == 200) {
        // Обновляем локальное состояние
        for (auto& notif : g_notifications) {
            if (notif.id == notification_id) {
                notif.is_read = true;
                break;
            }
        }
    }
}

std::string DownloadConfig(const std::string& id) {
    cpr::Session session;
    session.SetUrl(std::string(SERVER_URL) + "/api/files/games/configs/" + id + "/download");
    session.SetHeader({{"Authorization", "Bearer " + g_Token}});
    session.SetTimeout(cpr::Timeout{30000});
    session.SetSslOptions(cpr::Ssl(cpr::ssl::TLSv1_2{}, cpr::ssl::VerifyHost{false}, cpr::ssl::VerifyPeer{false}));

    auto response = session.Get();
    if (response.status_code == 200) {
        std::string path = "/sdcard/Download/config_" + id + ".txt";
        std::ofstream file(path, std::ios::binary);
        if (file.is_open()) {
            file.write(response.text.data(), response.text.size());
            return "Saved to " + path;
        }
        return "File write error";
    }
    return "Download failed: " + std::to_string(response.status_code);
}

std::string DownloadProductFile(const std::string& product_id, const std::string& file_type, const std::string& file_name) {
    if (g_Token.empty()) return "";
    
    cpr::Session session;
    session.SetUrl(std::string(SERVER_URL) + "/api/files/product-files/" + product_id + "/download/" + file_type);
    session.SetHeader({{"Authorization", "Bearer " + g_Token}});
    session.SetTimeout(cpr::Timeout{30000});
    session.SetSslOptions(cpr::Ssl(cpr::ssl::TLSv1_2{}, cpr::ssl::VerifyHost{false}, cpr::ssl::VerifyPeer{false}));

    auto response = session.Get();
    if (response.status_code == 200) {
        // Определяем расширение файла на основе типа
        std::string ext = ".png";  // По умолчанию для изображений
        if (file_type == "agent" || file_type == "file") {
            ext = ".bin";  // Для loader файла
        } else if (file_type == "logo" || file_type == "banner" || file_type == "background") {
            ext = ".png";  // Для изображений
        }
        
        // Пытаемся определить расширение из Content-Type заголовка
        auto content_type = response.header.find("Content-Type");
        if (content_type != response.header.end()) {
            std::string ct = content_type->second;
            if (ct.find("image/jpeg") != std::string::npos || ct.find("image/jpg") != std::string::npos) {
                ext = ".jpg";
            } else if (ct.find("image/png") != std::string::npos) {
                ext = ".png";
            } else if (ct.find("application/octet-stream") != std::string::npos || ct.find("application/x-msdownload") != std::string::npos) {
                ext = ".exe";  // Для исполняемых файлов
            }
        }
        
        std::string path = "/sdcard/Download/product_" + product_id + "_" + file_name + ext;
        std::ofstream file(path, std::ios::binary);
        if (file.is_open()) {
            // response.text содержит бинарные данные
            file.write(response.text.data(), response.text.size());
            file.close();
            LOGI("Downloaded product file: %s to %s", file_type.c_str(), path.c_str());
            return path;
        }
        LOGE("Failed to write product file: %s", file_type.c_str());
        return "";
    }
    LOGE("Failed to download product file: %s, status: %d", file_type.c_str(), response.status_code);
    return "";
}

std::string UploadConfig(const std::string& path, const std::string& name, const std::string& desc, bool is_public) {
    std::ifstream file(path, std::ios::binary | std::ios::ate);
    if (!file.is_open()) return "Cannot open file";
    std::streamsize size = file.tellg();
    file.seekg(0, std::ios::beg);
    std::vector<char> buffer(size);
    if (!file.read(buffer.data(), size)) return "Read error";

    cpr::Session session;
    session.SetUrl(std::string(SERVER_URL) + "/api/files/game-files/config");
    session.SetHeader({{"Authorization", "Bearer " + g_Token}});
    session.SetSslOptions(cpr::Ssl(cpr::ssl::TLSv1_2{}, cpr::ssl::VerifyHost{false}, cpr::ssl::VerifyPeer{false}));

    std::string filename = path.substr(path.find_last_of("/\\") + 1);
    std::string filename_copy = filename; // Create copy for Buffer constructor which expects rvalue
    cpr::Multipart multipart{
            {"game_name", g_gameName.empty() ? "PUBG" : g_gameName},
            {"name", name},
            {"description", desc},
            {"version", "1.0"},
            {"is_public", is_public ? "true" : "false"}
    };
    multipart.parts.push_back(cpr::Part{"file", cpr::Buffer{buffer.begin(), buffer.end(), std::move(filename_copy)}, filename});
    session.SetMultipart(multipart);

    auto response = session.Post();
    if (response.status_code == 201) {
        try {
            json res = json::parse(response.text);
            if (res.contains("config") && res["config"].contains("config_id"))
                return "Uploaded! ID: " + res["config"]["config_id"].get<std::string>();
        } catch(...) {}
        return "Uploaded successfully";
    }
    return "Upload failed: " + std::to_string(response.status_code);
}

void SetupImGuiStyle() {
    ImGuiStyle& style = ImGui::GetStyle();
    ImGui::StyleColorsDark();

    // Более округлые углы для симпатичного вида
    style.WindowRounding = 20.0f;
    style.FrameRounding = 12.0f;
    style.PopupRounding = 12.0f;
    style.ScrollbarRounding = 10.0f;
    style.GrabRounding = 10.0f;
    style.TabRounding = 10.0f;
    style.ChildRounding = 12.0f;

    // Больше отступов для более просторного вида
    style.WindowPadding = ImVec2(20, 20);
    style.FramePadding = ImVec2(15, 12);
    style.ItemSpacing = ImVec2(12, 10);
    style.ItemInnerSpacing = ImVec2(8, 6);
    style.ScrollbarSize = 16.0f;
    style.GrabMinSize = 20.0f;

    ImVec4* colors = style.Colors;
    // Более мягкий фон окна
    colors[ImGuiCol_WindowBg] = ImVec4(0.10f, 0.10f, 0.13f, 0.98f);
    // Более яркая и мягкая граница
    colors[ImGuiCol_Border] = ImVec4(0.40f, 0.50f, 0.70f, 0.60f);
    colors[ImGuiCol_FrameBg] = ImVec4(0.18f, 0.20f, 0.25f, 1.00f);
    colors[ImGuiCol_FrameBgHovered] = ImVec4(0.25f, 0.30f, 0.40f, 1.00f);
    colors[ImGuiCol_FrameBgActive] = ImVec4(0.30f, 0.35f, 0.45f, 1.00f);
    colors[ImGuiCol_TitleBgActive] = ImVec4(0.20f, 0.25f, 0.35f, 1.00f);
    // Более яркие и симпатичные кнопки с градиентом
    colors[ImGuiCol_Button] = ImVec4(0.35f, 0.50f, 0.75f, 1.00f);
    colors[ImGuiCol_ButtonHovered] = ImVec4(0.45f, 0.60f, 0.85f, 1.00f);
    colors[ImGuiCol_ButtonActive] = ImVec4(0.30f, 0.45f, 0.70f, 1.00f);
    // Более яркие акценты
    colors[ImGuiCol_CheckMark] = ImVec4(0.50f, 0.75f, 1.00f, 1.00f);
    colors[ImGuiCol_SliderGrab] = ImVec4(0.50f, 0.70f, 1.00f, 1.00f);
    colors[ImGuiCol_SliderGrabActive] = ImVec4(0.60f, 0.80f, 1.00f, 1.00f);
    colors[ImGuiCol_Header] = ImVec4(0.30f, 0.45f, 0.65f, 1.00f);
    colors[ImGuiCol_HeaderHovered] = ImVec4(0.40f, 0.55f, 0.75f, 1.00f);
    colors[ImGuiCol_HeaderActive] = ImVec4(0.35f, 0.50f, 0.70f, 1.00f);
    // Более мягкий текст
    colors[ImGuiCol_Text] = ImVec4(0.95f, 0.95f, 0.98f, 1.00f);
    colors[ImGuiCol_TextDisabled] = ImVec4(0.50f, 0.50f, 0.55f, 1.00f);
}

// --- MAIN ACTIVITY ---

void android_main(struct android_app* app) {
    g_App = app;
    app->onAppCmd = [](android_app* app, int32_t cmd) {};
    app->onInputEvent = [](android_app* app, AInputEvent* event) -> int {
        return ImGui_ImplAndroid_HandleInputEvent(event);
    };

    while (!app->window) {
        int events;
        android_poll_source* source;
        while (ALooper_pollOnce(0, nullptr, &events, (void**)&source) >= 0) {
            if (source) source->process(app, source);
        }
    }

    EGLObjects egl = init_egl(app->window);
    if (egl.display == EGL_NO_DISPLAY) return;

    IMGUI_CHECKVERSION();
    ImGui::CreateContext();
    ImGuiIO& io = ImGui::GetIO();
    io.Fonts->AddFontFromFileTTF("/system/fonts/Roboto-Regular.ttf", 36.0f); // Larger font for mobile

    // Clipboard linkage
    io.GetClipboardTextFn = [](void* user_data) -> const char* {
        static std::string clipboard;
        clipboard = GetClipboardText((android_app*)user_data);
        return clipboard.c_str();
    };
    io.ClipboardUserData = app;

    io.ConfigFlags |= ImGuiConfigFlags_NavEnableKeyboard;
    io.FontGlobalScale = 1.0f;

    SetupImGuiStyle();
    ImGui_ImplAndroid_Init(app->window);
    ImGui_ImplOpenGL3_Init(egl.context ? "#version 300 es" : "#version 100");

    // Загружаем сохраненный offline_ticket при запуске
    LoadOfflineTicket();

    // UI State
    char keyInput[64] = "";
    char usernameInput[64] = "";
    char passwordInput[64] = "";
    char emailInput[64] = "";

    char configIdInput[16] = "";
    char configNameInput[64] = "";
    char configDescInput[128] = "";
    char configPathInput[256] = "/sdcard/Download/config.txt";
    bool configIsPublic = true;
    std::string configStatusMsg;

    std::string statusMessage = "Please authenticate to continue.";
    bool isLoading = false;
    float loadingProgress = 0.0f;

    enum Screen { Login, Main };
    Screen currentScreen = Screen::Login;
    enum LoginMode { Key, Account };
    LoginMode loginMode = LoginMode::Key;
    bool showRegistration = false;

    while (true) {
        int events;
        android_poll_source* source;
        while (ALooper_pollOnce(0, nullptr, &events, (void**)&source) >= 0) {
            if (source) source->process(app, source);
            if (app->destroyRequested != 0) goto cleanup;
        }

        ImGui_ImplOpenGL3_NewFrame();
        ImGui_ImplAndroid_NewFrame();
        ImGui::NewFrame();

        int width = ANativeWindow_getWidth(app->window);
        int height = ANativeWindow_getHeight(app->window);

        // Responsive Window Logic
        float winWidth = std::min((float)width * 0.95f, 800.0f); // Max 800px width, 95% of screen
        float centerX = ((float)width - winWidth) / 2.0f;

        if (isLoading) {
            loadingProgress += io.DeltaTime * 0.5f;
            if(loadingProgress > 1.0f) loadingProgress = 0.0f;
        }

        if (currentScreen == Login) {
            ImGui::SetNextWindowPos(ImVec2(centerX, (float)height * 0.1f), ImGuiCond_FirstUseEver);
            ImGui::SetNextWindowSize(ImVec2(winWidth, 0), ImGuiCond_Always);

            if (ImGui::Begin("Authentication", nullptr, ImGuiWindowFlags_NoCollapse | ImGuiWindowFlags_NoResize | ImGuiWindowFlags_NoTitleBar)) {
                // Заголовок с красивым стилем
                ImGui::PushStyleColor(ImGuiCol_Text, ImVec4(0.5f, 0.7f, 1.0f, 1.0f));
                ImGui::SetWindowFontScale(1.2f);
                ImGui::Text("GAME: %s", g_gameName.empty() ? "Unknown" : g_gameName.c_str());
                ImGui::SetWindowFontScale(1.0f);
                ImGui::PopStyleColor();
                ImGui::Spacing();
                ImGui::Separator();
                ImGui::Spacing();

                // Tabs с улучшенным стилем
                ImGui::BeginGroup();
                if(loginMode == Key) ImGui::PushStyleColor(ImGuiCol_Button, ImVec4(0.45f, 0.65f, 0.90f, 1.0f));
                if(ImGui::Button("License Key", ImVec2(winWidth/2 - 20, 55))) {
                    loginMode = Key;
                    showRegistration = false;
                }
                if(loginMode == Key) ImGui::PopStyleColor();

                ImGui::SameLine();

                if(loginMode == Account) ImGui::PushStyleColor(ImGuiCol_Button, ImVec4(0.45f, 0.65f, 0.90f, 1.0f));
                if(ImGui::Button("Account", ImVec2(winWidth/2 - 20, 55))) loginMode = Account;
                if(loginMode == Account) ImGui::PopStyleColor();
                ImGui::EndGroup();

                ImGui::Spacing();
                ImGui::Separator();
                ImGui::Spacing();

                if (loginMode == Key) {
                    ImGui::Text("Enter License Key:");
                    ImGui::InputText("##key", keyInput, sizeof(keyInput), ImGuiInputTextFlags_Password);
                    if (ImGui::Button("Paste from Clipboard", ImVec2(-1, 50))) {
                        const char* clip = io.GetClipboardTextFn(io.ClipboardUserData);
                        if(clip) snprintf(keyInput, sizeof(keyInput), "%s", clip);
                    }

                    ImGui::Spacing();
                    if (ImGui::Button(isLoading ? "Checking..." : "Login", ImVec2(-1, 65))) {
                        if (!isLoading && strlen(keyInput) > 0) {
                            isLoading = true;
                            // Thread this in production!
                            JNIEnv* env = nullptr;
                            app->activity->vm->AttachCurrentThread(&env, nullptr);
                            std::string res = CheckLicense(keyInput, g_gameName.c_str(), env, app->activity->clazz, nullptr);
                            app->activity->vm->DetachCurrentThread();

                            isLoading = false;
                            if (res.find("VALID") == 0) {
                                currentScreen = Main;
                                statusMessage = "License Verified!";
                                ShowImGuiToast("Login Successful", "success");
                                LoadChangelog();
                                // Уведомления уже загружены из ответа connect в функции ConnectWithChallenge
                            } else {
                                statusMessage = res;
                                ShowImGuiToast("Login Failed", "error");
                            }
                        }
                    }
                } else {
                    ImGui::Text("Username:");
                    ImGui::InputText("##user", usernameInput, sizeof(usernameInput));
                    ImGui::Text("Password:");
                    ImGui::InputText("##pass", passwordInput, sizeof(passwordInput), ImGuiInputTextFlags_Password);

                    if (showRegistration) {
                        ImGui::Text("Email (Optional):");
                        ImGui::InputText("##email", emailInput, sizeof(emailInput));
                        if (ImGui::Button("Register", ImVec2(-1, 60))) {
                            if(!isLoading && strlen(usernameInput) > 3 && strlen(passwordInput) > 3) {
                                isLoading = true;
                                std::string res = RegisterAccount(usernameInput, passwordInput, emailInput);
                                isLoading = false;
                                statusMessage = res;
                                if(res.find("Success") != std::string::npos) {
                                    showRegistration = false;
                                    ShowImGuiToast("Account Created", "success");
                                } else ShowImGuiToast("Registration Failed", "error");
                            }
                        }
                        if(ImGui::Button("Back to Login", ImVec2(-1, 50))) showRegistration = false;
                    } else {
                        if (ImGui::Button(isLoading ? "Logging in..." : "Login", ImVec2(-1, 65))) {
                            if(!isLoading && strlen(usernameInput) > 0) {
                                isLoading = true;
                                std::string res = LoginWithCredentials(usernameInput, passwordInput);
                                isLoading = false;
                                if(res.find("VALID") == 0) {
                                    currentScreen = Main;
                                    statusMessage = "Logged in as " + std::string(usernameInput);
                                    ShowImGuiToast("Welcome back!", "success");
                                    LoadChangelog();
                                    LoadNotifications(true); // Загружаем непрочитанные уведомления
                                } else {
                                    statusMessage = res;
                                    ShowImGuiToast("Login Failed", "error");
                                }
                            }
                        }
                        if(ImGui::Button("Create Account", ImVec2(-1, 50))) showRegistration = true;
                    }
                }

                ImGui::Spacing();
                ImGui::Separator();
                ImGui::TextWrapped("%s", statusMessage.c_str());
                if(isLoading) ImGui::ProgressBar(loadingProgress, ImVec2(-1, 5));

                ImGui::End();
            }

        } else if (currentScreen == Main) {

            ImGui::SetNextWindowPos(ImVec2(centerX, (float)height * 0.05f), ImGuiCond_FirstUseEver);
            ImGui::SetNextWindowSize(ImVec2(winWidth, 0), ImGuiCond_Always);

            if (ImGui::Begin("Main Menu", nullptr, ImGuiWindowFlags_NoCollapse | ImGuiWindowFlags_NoResize | ImGuiWindowFlags_NoTitleBar)) {
                // Заголовок меню с красивым стилем
                ImGui::PushStyleColor(ImGuiCol_Text, ImVec4(0.5f, 0.7f, 1.0f, 1.0f));
                ImGui::SetWindowFontScale(1.3f);
                ImGui::Text("Main Menu");
                ImGui::SetWindowFontScale(1.0f);
                ImGui::PopStyleColor();
                ImGui::Spacing();
                
                if (ImGui::Button("Logout", ImVec2(-1, 50))) {
                    g_Token.clear();
                    currentScreen = Login;
                    statusMessage = "Logged out.";
                }

                ImGui::Spacing();
                ImGui::Separator();
                ImGui::Spacing();
                
                // Статус с более ярким цветом
                ImGui::PushStyleColor(ImGuiCol_Text, ImVec4(0.2f, 1.0f, 0.6f, 1.0f));
                ImGui::Text("Status: Active");
                ImGui::PopStyleColor();
                ImGui::TextWrapped("%s", statusMessage.c_str());
                
                ImGui::Spacing();
                ImGui::Separator();
                ImGui::Spacing();

                // Кнопка с увеличенной высотой
                if (ImGui::Button("View Changelog", ImVec2(-1, 60))) {
                    g_showChangelog = true;
                    LoadChangelog(); // Refresh
                }

                ImGui::Spacing();
                
                // Кнопка для уведомлений с индикатором непрочитанных
                int unread_count = 0;
                for (const auto& notif : g_notifications) {
                    if (!notif.is_read) unread_count++;
                }
                
                std::string notifButtonText = "Notifications";
                if (unread_count > 0) {
                    notifButtonText += " (" + std::to_string(unread_count) + ")";
                }
                
                if (ImGui::Button(notifButtonText.c_str(), ImVec2(-1, 60))) {
                    g_showNotifications = true;
                    LoadNotifications(false); // Загружаем все уведомления
                }

                ImGui::Spacing();
                ImGui::Spacing();
                
                // Заголовок секции
                ImGui::PushStyleColor(ImGuiCol_Text, ImVec4(0.6f, 0.8f, 1.0f, 1.0f));
                ImGui::Text("Config Manager");
                ImGui::PopStyleColor();
                
                ImGui::Spacing();
                ImGui::BeginGroup();
                // Кнопки с большей высотой и отступами
                if (ImGui::Button("Download Config", ImVec2(winWidth/2 - 20, 70))) g_showConfigDownloader = true;
                ImGui::SameLine();
                if (ImGui::Button("Upload Config", ImVec2(winWidth/2 - 20, 70))) g_showConfigUploader = true;
                ImGui::EndGroup();

                ImGui::End();
            }

            // --- OVERLAYS ---

            if (g_showChangelog) {
                ImGui::SetNextWindowPos(ImVec2(width * 0.05f, height * 0.05f), ImGuiCond_Always);
                ImGui::SetNextWindowSize(ImVec2(width * 0.9f, height * 0.9f), ImGuiCond_Always);

                if (ImGui::Begin("Changelog", &g_showChangelog)) {
                    if (g_changelogEntries.empty()) {
                        ImGui::Text("No changes found or loading...");
                        if(ImGui::Button("Retry")) LoadChangelog();
                    } else {
                        for (const auto& entry : g_changelogEntries) {
                            ImGui::TextColored(ImVec4(0.3f, 0.7f, 1.0f, 1.0f), "v%s - %s", entry.version.c_str(), entry.title.c_str());
                            ImGui::TextDisabled("%s", entry.release_date.c_str());
                            ImGui::TextWrapped("%s", entry.description.c_str());
                            for(const auto& c : entry.changes) ImGui::BulletText("%s", c.c_str());
                            ImGui::Separator();
                        }
                    }
                    ImGui::End();
                }
            }

            if (g_showConfigDownloader) {
                ImGui::SetNextWindowPos(ImVec2(centerX, height * 0.3f), ImGuiCond_Always);
                ImGui::SetNextWindowSize(ImVec2(winWidth, 0), ImGuiCond_Always);
                if (ImGui::Begin("Download Config", &g_showConfigDownloader)) {
                    ImGui::Text("Enter 8-character ID:");
                    ImGui::InputText("##dlid", configIdInput, sizeof(configIdInput));
                    ImGui::SameLine();
                    if(ImGui::Button("Paste")) {
                        const char* c = io.GetClipboardTextFn(io.ClipboardUserData);
                        if(c) snprintf(configIdInput, sizeof(configIdInput), "%s", c);
                    }

                    if (ImGui::Button("Download Now", ImVec2(-1, 50))) {
                        if(strlen(configIdInput) == 8) {
                            configStatusMsg = DownloadConfig(configIdInput);
                            ShowImGuiToast(configStatusMsg, configStatusMsg.find("Saved") != std::string::npos ? "success" : "error");
                        } else ShowImGuiToast("Invalid ID length", "warning");
                    }
                    ImGui::TextWrapped("%s", configStatusMsg.c_str());
                    ImGui::End();
                }
            }

            if (g_showConfigUploader) {
                ImGui::SetNextWindowPos(ImVec2(centerX, height * 0.2f), ImGuiCond_Always);
                ImGui::SetNextWindowSize(ImVec2(winWidth, 0), ImGuiCond_Always);
                if (ImGui::Begin("Upload Config", &g_showConfigUploader)) {
                    ImGui::InputText("Config Name", configNameInput, sizeof(configNameInput));
                    ImGui::InputText("Description", configDescInput, sizeof(configDescInput));
                    ImGui::InputText("File Path", configPathInput, sizeof(configPathInput));
                    ImGui::Checkbox("Public", &configIsPublic);

                    if (ImGui::Button("Upload Now", ImVec2(-1, 50))) {
                        configStatusMsg = UploadConfig(configPathInput, configNameInput, configDescInput, configIsPublic);
                        if(configStatusMsg.find("Uploaded") != std::string::npos) ShowImGuiToast(configStatusMsg, "success", 5.0f);
                        else ShowImGuiToast(configStatusMsg, "error");
                    }
                    ImGui::End();
                }
            }

            if (g_showNotifications) {
                ImGui::SetNextWindowPos(ImVec2(width * 0.05f, height * 0.05f), ImGuiCond_Always);
                ImGui::SetNextWindowSize(ImVec2(width * 0.9f, height * 0.9f), ImGuiCond_Always);

                if (ImGui::Begin("Notifications", &g_showNotifications)) {
                    ImGui::BeginGroup();
                    if (ImGui::Button("Refresh", ImVec2(150, 40))) {
                        LoadNotifications(false);
                    }
                    ImGui::SameLine();
                    if (ImGui::Button("Unread Only", ImVec2(150, 40))) {
                        LoadNotifications(true);
                    }
                    ImGui::EndGroup();
                    ImGui::Spacing();
                    ImGui::Separator();
                    ImGui::Spacing();

                    if (g_notifications.empty()) {
                        ImGui::Text("No notifications found.");
                        if (ImGui::Button("Retry")) LoadNotifications(false);
                    } else {
                        for (auto& notif : g_notifications) {
                            ImGui::PushID(notif.id);
                            
                            ImVec4 typeColor = ImVec4(0.5f, 0.7f, 1.0f, 1.0f); // default info
                            if (notif.type == "error") typeColor = ImVec4(0.9f, 0.2f, 0.2f, 1.0f);
                            else if (notif.type == "warning") typeColor = ImVec4(1.0f, 0.7f, 0.0f, 1.0f);
                            else if (notif.type == "success") typeColor = ImVec4(0.0f, 0.8f, 0.2f, 1.0f);
                            
                            // Фон для непрочитанных
                            if (!notif.is_read) {
                                ImGui::PushStyleColor(ImGuiCol_ChildBg, ImVec4(0.2f, 0.3f, 0.4f, 0.3f));
                            }
                            
                            ImGui::BeginChild(("notif_" + std::to_string(notif.id)).c_str(), 
                                            ImVec2(0, 0), true, 
                                            notif.is_read ? ImGuiWindowFlags_None : ImGuiWindowFlags_None);
                            
                            ImGui::BeginGroup();
                            ImGui::TextColored(typeColor, "[%s]", notif.type.c_str());
                            ImGui::SameLine();
                            if (!notif.is_read) {
                                ImGui::TextColored(ImVec4(1.0f, 1.0f, 0.0f, 1.0f), "● NEW");
                                ImGui::SameLine();
                            }
                            ImGui::TextDisabled("%s", notif.created_at.c_str());
                            ImGui::EndGroup();
                            
                            ImGui::Spacing();
                            ImGui::TextWrapped("%s", notif.message.c_str());
                            
                            ImGui::Spacing();
                            if (!notif.is_read && ImGui::Button("Mark as Read", ImVec2(150, 30))) {
                                MarkNotificationAsRead(notif.id);
                            }
                            
                            ImGui::EndChild();
                            
                            if (!notif.is_read) {
                                ImGui::PopStyleColor();
                            }
                            
                            ImGui::Spacing();
                            ImGui::PopID();
                        }
                    }
                    ImGui::End();
                }
            }
        }

        RenderToasts();

        ImGui::Render();
        glViewport(0, 0, io.DisplaySize.x, io.DisplaySize.y);
        glClearColor(0.05f, 0.05f, 0.05f, 1.0f);
        glClear(GL_COLOR_BUFFER_BIT);
        ImGui_ImplOpenGL3_RenderDrawData(ImGui::GetDrawData());
        eglSwapBuffers(egl.display, egl.surface);
    }

    cleanup:
    ImGui_ImplOpenGL3_Shutdown();
    ImGui_ImplAndroid_Shutdown();
    ImGui::DestroyContext();
    terminate_egl(egl);
}