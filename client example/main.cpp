// System includes
#include <algorithm>
#include <cctype>
#include <cstdio>
#include <cstring>
#include <fstream>
#include <iomanip>
#include <iostream>
#include <memory>
#include <random>
#include <sstream>
#include <stdexcept>
#include <string>
#include <vector>

// Android includes
#include <android/input.h>
#include <android/keycodes.h>
#include <android/log.h>
#include <android/native_activity.h>
#include <android_native_app_glue.h>
#include <jni.h>

// OpenGL/EGL includes
#include <EGL/egl.h>
#include <GLES3/gl3.h>

// ImGui includes
#include "imgui.h"
#include "backends/imgui_impl_android.h"
#include "backends/imgui_impl_opengl3.h"

// OpenSSL includes
#include <openssl/bio.h>
#include <openssl/buffer.h>
#include <openssl/err.h>
#include <openssl/evp.h>
#include <openssl/hmac.h>
#include <openssl/pem.h>
#include <openssl/rand.h>
#include <openssl/ssl.h>
#include <openssl/x509.h>

// Project includes
#include "LOGIN/Login.h"
#include "LOGIN/cpr/cpr.h"
#include "LOGIN/json.hpp"

#define LOGI(...) __android_log_print(ANDROID_LOG_INFO, "LicenseCheck", __VA_ARGS__)
#define LOGE(...) __android_log_print(ANDROID_LOG_ERROR, "LicenseCheck", __VA_ARGS__)

using json = nlohmann::json;

// Configuration
// Бэкенд запущен в Docker на порту 5001 (по умолчанию из docker-compose.yml)
//
// Для эмулятора Android используйте: "http://10.0.2.2:5001"
//   10.0.2.2 - это специальный IP адрес, который эмулятор использует для доступа к хосту
//
// Для реального Android устройства используйте IP вашего компьютера в локальной сети:
//   "http://<IP_вашего_компьютера>:5001"
//   Например: "http://192.168.1.80:5001"
//
// Чтобы узнать IP вашего компьютера:
//   Mac/Linux: ifconfig | grep "inet " | grep -v 127.0.0.1
//   Windows: ipconfig (ищите IPv4 адрес, обычно начинается с 192.168. или 10.)
//
// Если вы изменили API_PORT в .env файле, используйте тот порт вместо 5001
//constexpr const char* SERVER_URL = "http://10.0.2.2:5001";  // Для эмулятора
constexpr const char* SERVER_URL = "http://192.168.1.80:5001";  // Для реального устройства
// constexpr const char* SERVER_URL = "http://192.168.1.80:5001";  // Для реального устройства - раскомментируйте и укажите ваш IP
const std::string MASTER_KEY = "ca3695f66cc428a41e6bc8c2ed7ee27b0940fe4da284ae03cc89b89edb35c339";

// Global state
extern std::string g_gameName;
android_app* g_App = nullptr;
std::string g_ProjectId = "9516412833";

#ifndef EGL_OPENGL_ES3_BIT_KHR
#define EGL_OPENGL_ES3_BIT_KHR 0x00000040
#endif

// ============================================================================
// EGL Management
// ============================================================================

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
    const char* LOG_TAG = "LicenseCheckEGL";

    const EGLint configAttribsGLES3[] = {
            EGL_RENDERABLE_TYPE, EGL_OPENGL_ES3_BIT_KHR,
            EGL_SURFACE_TYPE, EGL_WINDOW_BIT,
            EGL_BLUE_SIZE, 8,
            EGL_GREEN_SIZE, 8,
            EGL_RED_SIZE, 8,
            EGL_DEPTH_SIZE, 16,
            EGL_NONE
    };
    const EGLint contextAttribsGLES3[] = {
            EGL_CONTEXT_CLIENT_VERSION, 3,
            EGL_NONE
    };
    const EGLint configAttribsGLES2[] = {
            EGL_RENDERABLE_TYPE, EGL_OPENGL_ES2_BIT,
            EGL_SURFACE_TYPE, EGL_WINDOW_BIT,
            EGL_BLUE_SIZE, 8,
            EGL_GREEN_SIZE, 8,
            EGL_RED_SIZE, 8,
            EGL_DEPTH_SIZE, 16,
            EGL_NONE
    };
    const EGLint contextAttribsGLES2[] = {
            EGL_CONTEXT_CLIENT_VERSION, 2,
            EGL_NONE
    };

    egl.display = eglGetDisplay(EGL_DEFAULT_DISPLAY);
    if (egl.display == EGL_NO_DISPLAY) {
        __android_log_print(ANDROID_LOG_ERROR, LOG_TAG, "eglGetDisplay failed");
        return egl;
    }
    if (!eglInitialize(egl.display, &majorVersion, &minorVersion)) {
        __android_log_print(ANDROID_LOG_ERROR, LOG_TAG, "eglInitialize failed");
        return egl;
    }

    if (eglChooseConfig(egl.display, configAttribsGLES3, &config, 1, &numConfigs) && numConfigs > 0) {
        egl.surface = eglCreateWindowSurface(egl.display, config, window, nullptr);
        egl.context = eglCreateContext(egl.display, config, EGL_NO_CONTEXT, contextAttribsGLES3);
        if (egl.surface != EGL_NO_SURFACE && egl.context != EGL_NO_CONTEXT) {
            if (!eglMakeCurrent(egl.display, egl.surface, egl.surface, egl.context)) {
                __android_log_print(ANDROID_LOG_ERROR, LOG_TAG, "eglMakeCurrent (GLES3) failed");
            }
            __android_log_print(ANDROID_LOG_INFO, LOG_TAG, "EGL context: OpenGL ES 3.0");
            return egl;
        }
    }
    __android_log_print(ANDROID_LOG_WARN, LOG_TAG, "Falling back to OpenGL ES 2.0");
    if (eglChooseConfig(egl.display, configAttribsGLES2, &config, 1, &numConfigs) && numConfigs > 0) {
        egl.surface = eglCreateWindowSurface(egl.display, config, window, nullptr);
        egl.context = eglCreateContext(egl.display, config, EGL_NO_CONTEXT, contextAttribsGLES2);
        if (egl.surface != EGL_NO_SURFACE && egl.context != EGL_NO_CONTEXT) {
            if (!eglMakeCurrent(egl.display, egl.surface, egl.surface, egl.context)) {
                __android_log_print(ANDROID_LOG_ERROR, LOG_TAG, "eglMakeCurrent (GLES2) failed");
            }
            __android_log_print(ANDROID_LOG_INFO, LOG_TAG, "EGL context: OpenGL ES 2.0");
            return egl;
        }
    }
    __android_log_print(ANDROID_LOG_ERROR, LOG_TAG, "Failed to create EGL context");
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

// ============================================================================
// JNI Helpers
// ============================================================================

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
        if (!clipboardServiceField) break;
        jstring clipboardServiceName = (jstring)env->GetStaticObjectField(contextClass, clipboardServiceField);
        if (!clipboardServiceName) break;

        jobject clipboardManager = env->CallObjectMethod(app->activity->clazz, getSystemService, clipboardServiceName);
        if (env->ExceptionCheck() || !clipboardManager) break;
        jclass clipboardManagerClass = env->FindClass("android/content/ClipboardManager");
        if (!clipboardManagerClass) break;
        jmethodID getPrimaryClip = env->GetMethodID(clipboardManagerClass, "getPrimaryClip", "()Landroid/content/ClipData;");
        if (!getPrimaryClip) break;
        jobject clip = env->CallObjectMethod(clipboardManager, getPrimaryClip);
        if (env->ExceptionCheck() || !clip) break;

        jclass clipDataClass = env->FindClass("android/content/ClipData");
        if (!clipDataClass) break;
        jmethodID getItemAt = env->GetMethodID(clipDataClass, "getItemAt", "(I)Landroid/content/ClipData$Item;");
        if (!getItemAt) break;
        jobject item = env->CallObjectMethod(clip, getItemAt, 0);
        if (env->ExceptionCheck() || !item) break;

        jclass itemClass = env->FindClass("android/content/ClipData$Item");
        if (!itemClass) break;
        jmethodID getText = env->GetMethodID(itemClass, "getText", "()Ljava/lang/CharSequence;");
        if (!getText) break;
        jobject text = env->CallObjectMethod(item, getText);
        if (env->ExceptionCheck() || !text) break;

        jclass charSequenceClass = env->FindClass("java/lang/CharSequence");
        if (!charSequenceClass) break;
        jmethodID toString = env->GetMethodID(charSequenceClass, "toString", "()Ljava/lang/String;");
        if (!toString) break;
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

// String decryption function (XOR-based)
std::string StrEnc(const char* encrypted, const char* key, size_t length) {
    std::string result;
    result.reserve(length);
    for (size_t i = 0; i < length; ++i) {
        result += static_cast<char>(encrypted[i] ^ key[i]);
    }
    return result;
}

jstring GetAndroidID(JNIEnv* env, jobject context) {
    jclass contextClass = env->FindClass(StrEnc("`L+&0^[S+-:J^$,r9q92(as", "\x01\x22\x4F\x54\x5F\x37\x3F\x7C\x48\x42\x54\x3E\x3B\x4A\x58\x5D\x7A\x1E\x57\x46\x4D\x19\x07", 23).c_str());
    jmethodID getContentResolverMethod = env->GetMethodID(contextClass, StrEnc("E8X\\7r7ys_Q%JS+L+~", "\x22\x5D\x2C\x1F\x58\x1C\x43\x1C\x1D\x2B\x03\x40\x39\x3C\x47\x3A\x4E\x0C", 18).c_str(), StrEnc("8^QKmj< }5D:9q7f.BXkef]A*GYLNg}B!/L", "\x10\x77\x1D\x2A\x03\x0E\x4E\x4F\x14\x51\x6B\x59\x56\x1F\x43\x03\x40\x36\x77\x28\x0A\x08\x29\x24\x44\x33\x0B\x29\x3D\x08\x11\x34\x44\x5D\x77", 35).c_str());
    jclass settingSecureClass = env->FindClass(StrEnc("T1yw^BCF^af&dB_@Raf}\\FS,zT~L(3Z\"", "\x35\x5F\x1D\x05\x31\x2B\x27\x69\x2E\x13\x09\x50\x0D\x26\x3A\x32\x7D\x32\x03\x09\x28\x2F\x3D\x4B\x09\x70\x2D\x29\x4B\x46\x28\x47", 32).c_str());
    jmethodID getStringMethod = env->GetStaticMethodID(settingSecureClass, StrEnc("e<F*J5c0Y", "\x02\x59\x32\x79\x3E\x47\x0A\x5E\x3E", 9).c_str(), StrEnc("$6*%R*!XO\"m18o,0S!*`uI$IW)l_/_knSdlRiO1T`2sH|Ouy__^}%Y)JsQ:-\"(2_^-$i{?H", "\x0C\x7A\x4B\x4B\x36\x58\x4E\x31\x2B\x0D\x0E\x5E\x56\x1B\x49\x5E\x27\x0E\x69\x0F\x1B\x3D\x41\x27\x23\x7B\x09\x2C\x40\x33\x1D\x0B\x21\x5F\x20\x38\x08\x39\x50\x7B\x0C\x53\x1D\x2F\x53\x1C\x01\x0B\x36\x31\x39\x46\x0C\x15\x43\x2B\x05\x30\x15\x41\x43\x46\x55\x70\x0D\x59\x56\x00\x15\x58\x73", 71).c_str());
    auto obj = env->CallObjectMethod(context, getContentResolverMethod);
    return (jstring)env->CallStaticObjectMethod(settingSecureClass, getStringMethod, obj, env->NewStringUTF(StrEnc("ujHO)8OfOE", "\x14\x04\x2C\x3D\x46\x51\x2B\x39\x26\x21", 10).c_str()));
}

jstring GetDeviceModel(JNIEnv* env) {
    jclass buildClass = env->FindClass(StrEnc("m5I{GKGWBP-VOxkA", "\x0C\x5B\x2D\x09\x28\x22\x23\x78\x2D\x23\x02\x14\x3A\x11\x07\x25", 16).c_str());
    jfieldID modelId = env->GetStaticFieldID(buildClass, StrEnc("|}[q:", "\x31\x32\x1F\x34\x76", 5).c_str(), StrEnc(".D:C:ETZ1O-Ib&^h.Y", "\x62\x2E\x5B\x35\x5B\x6A\x38\x3B\x5F\x28\x02\x1A\x16\x54\x37\x06\x49\x62", 18).c_str());
    return (jstring)env->GetStaticObjectField(buildClass, modelId);
}

jstring GetDeviceBrand(JNIEnv* env) {
    jclass buildClass = env->FindClass(StrEnc("0iW=2^>0zTRB!B90", "\x51\x07\x33\x4F\x5D\x37\x5A\x1F\x15\x27\x7D\x00\x54\x2B\x55\x54", 16).c_str());
    jfieldID modelId = env->GetStaticFieldID(buildClass, StrEnc("@{[FP", "\x02\x29\x1A\x08\x14", 5).c_str(), StrEnc(".D:C:ETZ1O-Ib&^h.Y", "\x62\x2E\x5B\x35\x5B\x6A\x38\x3B\x5F\x28\x02\x1A\x16\x54\x37\x06\x49\x62", 18).c_str());
    return (jstring)env->GetStaticObjectField(buildClass, modelId);
}

// ============================================================================
// Crypto Utilities
// ============================================================================

std::string sha256(const std::string& str) {
    unsigned char hash[32];
    EVP_MD_CTX* ctx = EVP_MD_CTX_new();
    EVP_DigestInit_ex(ctx, EVP_sha256(), nullptr);
    EVP_DigestUpdate(ctx, str.c_str(), str.size());
    EVP_DigestFinal_ex(ctx, hash, nullptr);
    EVP_MD_CTX_free(ctx);
    char buf[65];
    for (int i = 0; i < 32; ++i)
        sprintf(buf + i * 2, "%02x", hash[i]);
    buf[64] = 0;
    return std::string(buf);
}

std::string random_hex(size_t length) {
    static std::random_device rd;
    static std::mt19937 gen(rd());
    static std::uniform_int_distribution<> dis(0, 15);
    std::ostringstream oss;
    for (size_t i = 0; i < length; ++i) {
        oss << std::hex << std::nouppercase << dis(gen);
    }
    return oss.str();
}

std::string base64_encode(const std::vector<unsigned char>& data) {
    BIO* bio, * b64;
    BUF_MEM* bufferPtr;
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
    BIO* bio, * b64;
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
            std::string byte_str = master_key_hex.substr(i, 2);
            unsigned char byte = static_cast<unsigned char>(std::stoul(byte_str, nullptr, 16));
            key.push_back(byte);
        }

        std::vector<unsigned char> iv(12);
        RAND_bytes(iv.data(), iv.size());

        EVP_CIPHER_CTX* ctx = EVP_CIPHER_CTX_new();
        if (!ctx) {
            throw std::runtime_error("Failed to create cipher context");
        }

        std::vector<unsigned char> ciphertext(plaintext.size() + 32);
        int len, ciphertext_len;

        if (EVP_EncryptInit_ex(ctx, EVP_aes_256_gcm(), NULL, NULL, NULL) != 1 ||
            EVP_CIPHER_CTX_ctrl(ctx, EVP_CTRL_GCM_SET_IVLEN, 12, NULL) != 1 ||
            EVP_EncryptInit_ex(ctx, NULL, NULL, key.data(), iv.data()) != 1 ||
            EVP_EncryptUpdate(ctx, ciphertext.data(), &len, (unsigned char*)plaintext.data(), plaintext.size()) != 1) {
            EVP_CIPHER_CTX_free(ctx);
            throw std::runtime_error("Encryption failed");
        }
        ciphertext_len = len;

        if (EVP_EncryptFinal_ex(ctx, ciphertext.data() + len, &len) != 1) {
            EVP_CIPHER_CTX_free(ctx);
            throw std::runtime_error("Failed to finalize encryption");
        }
        ciphertext_len += len;

        std::vector<unsigned char> tag(16);
        if (EVP_CIPHER_CTX_ctrl(ctx, EVP_CTRL_GCM_GET_TAG, 16, tag.data()) != 1) {
            EVP_CIPHER_CTX_free(ctx);
            throw std::runtime_error("Failed to get authentication tag");
        }

        EVP_CIPHER_CTX_free(ctx);

        std::vector<unsigned char> combined(iv);
        combined.insert(combined.end(), ciphertext.begin(), ciphertext.begin() + ciphertext_len);
        combined.insert(combined.end(), tag.begin(), tag.end());

        return base64_encode(combined);
    } catch (const std::exception& e) {
        LOGE("encrypt_with_master_key error: %s", e.what());
        throw;
    }
}

std::string decrypt_with_master_key(const std::string& encrypted_data_b64, const std::string& master_key_hex) {
    LOGI("decrypt_with_master_key: ENTRY, data_length=%zu", encrypted_data_b64.length());
    try {
        std::vector<unsigned char> decoded = base64_decode(encrypted_data_b64);
        LOGI("decrypt_with_master_key: Decoded size=%zu", decoded.size());

        if (decoded.size() < 28) {
            throw std::runtime_error("Encrypted data too short");
        }

        std::vector<unsigned char> key;
        for (size_t i = 0; i < master_key_hex.length(); i += 2) {
            std::string byte_str = master_key_hex.substr(i, 2);
            unsigned char byte = static_cast<unsigned char>(std::stoul(byte_str, nullptr, 16));
            key.push_back(byte);
        }

        std::vector<unsigned char> iv(decoded.begin(), decoded.begin() + 12);
        std::vector<unsigned char> tag(decoded.end() - 16, decoded.end());
        std::vector<unsigned char> ciphertext(decoded.begin() + 12, decoded.end() - 16);

        EVP_CIPHER_CTX* ctx = EVP_CIPHER_CTX_new();
        if (!ctx) {
            throw std::runtime_error("Failed to create cipher context");
        }

        std::vector<unsigned char> plaintext(ciphertext.size() + 32);
        int len, plaintext_len;

        if (EVP_DecryptInit_ex(ctx, EVP_aes_256_gcm(), NULL, NULL, NULL) != 1 ||
            EVP_CIPHER_CTX_ctrl(ctx, EVP_CTRL_GCM_SET_IVLEN, 12, NULL) != 1 ||
            EVP_DecryptInit_ex(ctx, NULL, NULL, key.data(), iv.data()) != 1 ||
            EVP_DecryptUpdate(ctx, plaintext.data(), &len, ciphertext.data(), ciphertext.size()) != 1) {
            EVP_CIPHER_CTX_free(ctx);
            throw std::runtime_error("Decryption failed");
        }
        plaintext_len = len;

        if (EVP_CIPHER_CTX_ctrl(ctx, EVP_CTRL_GCM_SET_TAG, 16, tag.data()) != 1 ||
            EVP_DecryptFinal_ex(ctx, plaintext.data() + len, &len) != 1) {
            EVP_CIPHER_CTX_free(ctx);
            throw std::runtime_error("Authentication tag verification failed");
        }
        plaintext_len += len;

        EVP_CIPHER_CTX_free(ctx);
        plaintext.resize(plaintext_len);
        LOGI("decrypt_with_master_key: Decryption successful, plaintext length=%zu", plaintext_len);
        return std::string(plaintext.begin(), plaintext.end());
    } catch (const std::exception& e) {
        LOGE("decrypt_with_master_key error: %s", e.what());
        throw;
    }
}

// ============================================================================
// API Communication
// ============================================================================

class ApiClient {
public:
    static cpr::Session createSession() {
        cpr::Session session;
        session.SetHeader({{"Content-Type", "application/json"}});
        session.SetTimeout(cpr::Timeout{10000});
        session.SetSslOptions(cpr::Ssl(cpr::ssl::TLSv1_2{}, cpr::ssl::VerifyHost{false}, cpr::ssl::VerifyPeer{false}));
        return session;
    }

    static std::string getChallenge(const std::string& user_key, const std::string& fingerprint) {
        LOGI("GetChallenge: START - user_key=%s", user_key.c_str());

        cpr::Session session = createSession();
        session.SetUrl(std::string(SERVER_URL) + "/api/challenge");

        json challenge_data;
        challenge_data["user_key"] = user_key;
        challenge_data["fingerprint"] = fingerprint;
        challenge_data["project_id"] = g_ProjectId;

        session.SetBody(cpr::Body{challenge_data.dump()});
        LOGI("GetChallenge: Request JSON = %s", challenge_data.dump().c_str());

        cpr::Response response = session.Post();
        LOGI("GetChallenge: Response status=%d", response.status_code);

        if (response.status_code == 200) {
            try {
                json result = json::parse(response.text);
                std::string canary = result["canary"];

                std::string challenge;
                if (result.contains("challenge") && result["challenge"].is_object()) {
                    if (result["challenge"].contains("challenges") &&
                        result["challenge"]["challenges"].contains("crypto") &&
                        result["challenge"]["challenges"]["crypto"].contains("challenges")) {

                        auto crypto_challenges = result["challenge"]["challenges"]["crypto"]["challenges"];

                        if (crypto_challenges.contains("sha256") && crypto_challenges["sha256"].contains("input")) {
                            challenge = crypto_challenges["sha256"]["input"];
                        } else if (crypto_challenges.contains("combined") && crypto_challenges["combined"].contains("input")) {
                            challenge = crypto_challenges["combined"]["input"];
                        } else if (crypto_challenges.contains("md5") && crypto_challenges["md5"].contains("input")) {
                            challenge = crypto_challenges["md5"]["input"];
                        } else {
                            LOGE("GetChallenge: Could not find challenge input");
                            return "";
                        }
                    } else {
                        LOGE("GetChallenge: Invalid challenge structure");
                        return "";
                    }
                } else if (result.contains("challenge") && result["challenge"].is_string()) {
                    challenge = result["challenge"];
                } else {
                    LOGE("GetChallenge: Invalid challenge format");
                    return "";
                }

                if (result.contains("project_id")) {
                    g_ProjectId = std::to_string(result["project_id"].get<int>());
                }

                LOGI("GetChallenge: SUCCESS");
                return challenge + "|" + canary;
            } catch (const std::exception& e) {
                LOGE("GetChallenge: JSON parsing error: %s", e.what());
                return "";
            }
        } else {
            LOGE("GetChallenge: Server error: %d", response.status_code);
            return "";
        }
    }

    static std::string connect(const std::string& user_key,
                               const std::string& challenge_data,
                               const std::string& fingerprint,
                               const std::string& game_name,
                               const std::string& serial,
                               const std::string& android_id,
                               const std::string& device_model,
                               const std::string& device_brand) {
        LOGI("ConnectWithChallenge: START");

        size_t separator = challenge_data.find("|");
        if (separator == std::string::npos) {
            LOGE("ConnectWithChallenge: Invalid challenge data format");
            return "Ошибка: Неверный формат challenge";
        }

        std::string challenge = challenge_data.substr(0, separator);
        std::string canary = challenge_data.substr(separator + 1);

        std::string challenge_response;
        if (challenge.length() > 100) {
            challenge_response = sha256(challenge);
        } else {
            challenge_response = sha256(challenge + user_key + fingerprint);
        }

        std::string nonce = random_hex(16);

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
        data["j"] = nonce;
        data["k"] = g_ProjectId;

        std::string encrypted_blob = encrypt_with_master_key(data.dump(), MASTER_KEY);

        cpr::Session session = createSession();
        session.SetUrl(std::string(SERVER_URL) + "/api/connect");

        json request_data;
        request_data["blob"] = encrypted_blob;
        session.SetBody(cpr::Body{request_data.dump()});

        cpr::Response response = session.Post();
        LOGI("ConnectWithChallenge: Response status=%d", response.status_code);

        if (response.status_code == 200) {
            try {
                std::string decrypted_response = decrypt_with_master_key(response.text, MASTER_KEY);
                json result = json::parse(decrypted_response);

                if (result.contains("error")) {
                    return "Ошибка сервера: " + result["error"].get<std::string>();
                }

                if (result.contains("a") && result.contains("d") && result.contains("f")) {
                    std::string token = result["a"].get<std::string>() +
                                        result["d"].get<std::string>() +
                                        result["f"].get<std::string>();

                    if (result.contains("project_id")) {
                        g_ProjectId = std::to_string(result["project_id"].get<int>());
                    }

                    std::string expires_at = result.value("expires_at", "Never");
                    std::string seconds_left = result.value("seconds_left_human", "Unknown");

                    LOGI("ConnectWithChallenge: SUCCESS");
                    return "VALID|" + expires_at + "|" + seconds_left;
                } else {
                    return "Ошибка: Неверный формат ответа сервера";
                }
            } catch (const std::exception& e) {
                LOGE("ConnectWithChallenge: Decryption/parsing error: %s", e.what());
                return "Ошибка расшифровки ответа: " + std::string(e.what());
            }
        } else {
            try {
                json error_json = json::parse(response.text);
                if (error_json.contains("error")) {
                    std::string server_error = error_json["error"].get<std::string>();
                    if (server_error == "Key not found") {
                        return "Ключ лицензии не найден на сервере";
                    }
                    return "Ошибка сервера: " + server_error;
                }
            } catch (...) {
                try {
                    std::string decrypted_error = decrypt_with_master_key(response.text, MASTER_KEY);
                    json error_json = json::parse(decrypted_error);
                    if (error_json.contains("error")) {
                        return "Ошибка сервера: " + error_json["error"].get<std::string>();
                    }
                } catch (...) {}
            }
            return "Ошибка HTTP: " + std::to_string(response.status_code);
        }
    }
};

// ============================================================================
// License Checker
// ============================================================================

class LicenseChecker {
public:
    static std::string checkLicense(const char* user_key, const char* game_name, JNIEnv* env, jobject context) {
        LOGI("CheckLicense: START - user_key=%s", user_key);

        if (!user_key || strlen(user_key) == 0) {
            return "Ошибка: Ключ лицензии не может быть пустым";
        }

        std::string android_id = getAndroidId(env, context);
        std::string device_model = getDeviceModel(env);
        std::string device_brand = getDeviceBrand(env);

        std::string fingerprint = sha256(android_id + "-" + device_model + "-" + device_brand);
        std::string serial = android_id;

        std::string challenge_data = ApiClient::getChallenge(user_key, fingerprint);
        if (challenge_data.empty()) {
            return "Ошибка: Не удалось получить challenge от сервера";
        }

        std::string result = ApiClient::connect(user_key, challenge_data, fingerprint,
                                                game_name ? game_name : "", serial,
                                                android_id, device_model, device_brand);

        return result;
    }

private:
    static std::string getAndroidId(JNIEnv* env, jobject context) {
        jstring androidIdJStr = GetAndroidID(env, context);
        if (!androidIdJStr) return "unknown-device";
        const char* c_android_id = env->GetStringUTFChars(androidIdJStr, nullptr);
        std::string result = c_android_id ? c_android_id : "unknown-device";
        if (c_android_id) env->ReleaseStringUTFChars(androidIdJStr, c_android_id);
        env->DeleteLocalRef(androidIdJStr);
        return result;
    }

    static std::string getDeviceModel(JNIEnv* env) {
        jstring deviceModelJStr = GetDeviceModel(env);
        if (!deviceModelJStr) return "unknown-model";
        const char* c_device_model = env->GetStringUTFChars(deviceModelJStr, nullptr);
        std::string result = c_device_model ? c_device_model : "unknown-model";
        if (c_device_model) env->ReleaseStringUTFChars(deviceModelJStr, c_device_model);
        env->DeleteLocalRef(deviceModelJStr);
        return result;
    }

    static std::string getDeviceBrand(JNIEnv* env) {
        jstring deviceBrandJStr = GetDeviceBrand(env);
        if (!deviceBrandJStr) return "unknown-brand";
        const char* c_device_brand = env->GetStringUTFChars(deviceBrandJStr, nullptr);
        std::string result = c_device_brand ? c_device_brand : "unknown-brand";
        if (c_device_brand) env->ReleaseStringUTFChars(deviceBrandJStr, c_device_brand);
        env->DeleteLocalRef(deviceBrandJStr);
        return result;
    }
};

// ============================================================================
// JNI Interface Functions
// ============================================================================

std::string CheckLicense(const char* user_key, const char* game_name, JNIEnv* env, jobject context, const char* ca_path) {
    // ca_path is currently not used, but kept for API compatibility
    (void)ca_path; // Suppress unused parameter warning
    return LicenseChecker::checkLicense(user_key, game_name, env, context);
}

bool TestServerConnectivity() {
    // Simple connectivity test - try to get a challenge with dummy data
    try {
        std::string test_fingerprint = "test";
        std::string test_user_key = "test";
        std::string result = ApiClient::getChallenge(test_user_key, test_fingerprint);
        // If we get any response (even empty), server is reachable
        return true;
    } catch (...) {
        return false;
    }
}

// ============================================================================
// Main Application
// ============================================================================

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
    if (egl.display == EGL_NO_DISPLAY || egl.context == EGL_NO_CONTEXT || egl.surface == EGL_NO_SURFACE) {
        __android_log_print(ANDROID_LOG_ERROR, "LicenseCheck", "EGL initialization failed");
        return;
    }

    IMGUI_CHECKVERSION();
    ImGui::CreateContext();
    ImGuiIO& io = ImGui::GetIO();
    io.Fonts->AddFontFromFileTTF("/system/fonts/Roboto-Regular.ttf", 32.0f, NULL, io.Fonts->GetGlyphRangesCyrillic());
    io.GetClipboardTextFn = [](void* user_data) -> const char* {
        static std::string clipboard;
        clipboard = GetClipboardText(static_cast<android_app*>(user_data));
        return clipboard.c_str();
    };
    io.SetClipboardTextFn = [](void* user_data, const char* text) {};
    io.ClipboardUserData = app;
    ImGui::StyleColorsDark();
    io.ConfigErrorRecovery = false;
    io.ConfigFlags |= ImGuiConfigFlags_NavEnableKeyboard;
    io.ConfigFlags |= ImGuiConfigFlags_NavEnableGamepad;

    ImGuiStyle& style = ImGui::GetStyle();
    style.FramePadding = ImVec2(8.0f, 8.0f);
    style.ItemSpacing = ImVec2(8.0f, 6.0f);
    io.FontGlobalScale = 2.0f;

    ImGui_ImplAndroid_Init(app->window);
    ImGui_ImplOpenGL3_Init(egl.context ? "#version 300 es" : "#version 100");

    // UI State
    char keyInput[256] = "";
    std::string statusMessage = "Введите ключ лицензии и нажмите 'Проверить'";
    bool isLoading = false;
    float loadingProgress = 0.0f;
    std::string loadingText = "Проверяем лицензию...";

    int width, height;
    float scaleFactor;

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

        width = ANativeWindow_getWidth(app->window);
        height = ANativeWindow_getHeight(app->window);
        scaleFactor = static_cast<float>(height) / 1080.0f;

        // Main Window
        ImVec2 windowSize(380 * scaleFactor, 0);
        ImVec2 windowPos((width - windowSize.x) * 0.5f, height * 0.15f);
        ImGui::SetNextWindowPos(windowPos, ImGuiCond_FirstUseEver);
        ImGui::SetNextWindowSize(windowSize, ImGuiCond_FirstUseEver);

        ImGui::PushStyleVar(ImGuiStyleVar_WindowRounding, 15.0f);
        ImGui::PushStyleVar(ImGuiStyleVar_WindowPadding, ImVec2(20.0f, 20.0f));
        ImGui::PushStyleVar(ImGuiStyleVar_FrameRounding, 8.0f);
        ImGui::PushStyleColor(ImGuiCol_WindowBg, ImVec4(0.08f, 0.08f, 0.12f, 0.95f));
        ImGui::PushStyleColor(ImGuiCol_Border, ImVec4(0.2f, 0.4f, 0.8f, 0.6f));
        ImGui::PushStyleColor(ImGuiCol_Text, ImVec4(0.9f, 0.9f, 0.95f, 1.0f));

        if (ImGui::Begin("Проверка лицензии", nullptr, ImGuiWindowFlags_NoCollapse | ImGuiWindowFlags_NoResize)) {
            ImGui::PushStyleColor(ImGuiCol_Text, ImVec4(0.0f, 0.8f, 1.0f, 1.0f));
            ImGui::Text("Игра: %s", g_gameName.empty() ? "Не указана" : g_gameName.c_str());
            ImGui::PopStyleColor();
            ImGui::Separator();
            ImGui::Spacing();

            ImGui::PushStyleColor(ImGuiCol_Text, ImVec4(0.8f, 0.9f, 1.0f, 1.0f));
            ImGui::Text("Введите ключ лицензии:");
            ImGui::PopStyleColor();

            ImGui::PushStyleColor(ImGuiCol_FrameBg, ImVec4(0.12f, 0.12f, 0.18f, 0.8f));
            ImGui::PushStyleColor(ImGuiCol_FrameBgHovered, ImVec4(0.15f, 0.15f, 0.22f, 0.9f));
            ImGui::PushStyleColor(ImGuiCol_FrameBgActive, ImVec4(0.18f, 0.18f, 0.25f, 1.0f));
            ImGui::PushItemWidth(-1);
            ImGui::InputText("##key", keyInput, sizeof(keyInput), ImGuiInputTextFlags_Password);
            ImGui::PopItemWidth();
            ImGui::PopStyleColor(3);

            ImGui::Spacing();

            if (ImGui::Button("Вставить из буфера", ImVec2(-FLT_MIN, 45 * scaleFactor))) {
                const char* clipboard = ImGui::GetIO().GetClipboardTextFn(ImGui::GetIO().ClipboardUserData);
                if (clipboard) {
                    strncpy(keyInput, clipboard, sizeof(keyInput) - 1);
                    keyInput[sizeof(keyInput) - 1] = '\0';
                }
            }

            ImGui::Spacing();

            ImGui::PushStyleColor(ImGuiCol_Button, ImVec4(0.2f, 0.7f, 0.3f, 0.8f));
            ImGui::PushStyleColor(ImGuiCol_ButtonHovered, ImVec4(0.3f, 0.8f, 0.4f, 0.9f));
            ImGui::PushStyleColor(ImGuiCol_ButtonActive, ImVec4(0.1f, 0.6f, 0.2f, 1.0f));
            if (ImGui::Button(isLoading ? "Проверяем..." : "Проверить", ImVec2(-FLT_MIN, 50 * scaleFactor))) {
                if (!isLoading && strlen(keyInput) > 0) {
                    isLoading = true;
                    loadingProgress = 0.0f;
                    loadingText = "Подключаемся к серверу...";
                    statusMessage = "Проверяем лицензию...";

                    JNIEnv* env = nullptr;
                    app->activity->vm->AttachCurrentThread(&env, nullptr);
                    jobject context = app->activity->clazz;

                    std::string result = LicenseChecker::checkLicense(keyInput, g_gameName.c_str(), env, context);
                    app->activity->vm->DetachCurrentThread();

                    if (result.substr(0, 5) == "VALID") {
                        size_t first_pipe = result.find("|");
                        if (first_pipe != std::string::npos) {
                            size_t second_pipe = result.find("|", first_pipe + 1);
                            if (second_pipe != std::string::npos) {
                                std::string expires_at = result.substr(first_pipe + 1, second_pipe - first_pipe - 1);
                                std::string seconds_left = result.substr(second_pipe + 1);
                                statusMessage = "Лицензия действительна!\nИстекает: " + expires_at + "\nОсталось: " + seconds_left;
                            } else {
                                statusMessage = "Лицензия действительна!\nИстекает: " + result.substr(first_pipe + 1);
                            }
                        } else {
                            statusMessage = "Лицензия действительна!";
                        }
                    } else {
                        statusMessage = "Ошибка: " + result;
                    }

                    isLoading = false;
                    loadingProgress = 0.0f;
                } else if (strlen(keyInput) == 0) {
                    statusMessage = "Пожалуйста, введите ключ лицензии";
                }
            }
            ImGui::PopStyleColor(3);

            if (isLoading) {
                ImGui::Separator();
                ImGui::Spacing();
                ImGui::PushStyleColor(ImGuiCol_Text, ImVec4(0.2f, 0.8f, 1.0f, 1.0f));
                ImGui::Text("%s", loadingText.c_str());
                ImGui::PopStyleColor();
                ImGui::PushStyleColor(ImGuiCol_PlotHistogram, ImVec4(0.2f, 0.8f, 1.0f, 0.8f));
                ImGui::ProgressBar(loadingProgress, ImVec2(-FLT_MIN, 25 * scaleFactor));
                ImGui::PopStyleColor();
            }

            ImGui::Separator();
            ImGui::Spacing();
            ImGui::PushTextWrapPos(ImGui::GetCursorPosX() + windowSize.x - 32.0f);
            ImGui::TextWrapped("%s", statusMessage.c_str());
            ImGui::PopTextWrapPos();
        }
        ImGui::End();

        ImGui::PopStyleColor(3);
        ImGui::PopStyleVar(3);

        ImGui::Render();
        glViewport(0, 0, static_cast<int>(io.DisplaySize.x), static_cast<int>(io.DisplaySize.y));
        glClearColor(0.1f, 0.1f, 0.1f, 1.0f);
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
