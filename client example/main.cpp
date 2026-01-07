// ============================================================================
// System Includes
// ============================================================================
#include <algorithm>
#include <atomic>
#include <cctype>
#include <cstdio>
#include <cstring>
#include <fstream>
#include <iomanip>
#include <iostream>
#include <memory>
#include <mutex>
#include <random>
#include <sstream>
#include <stdexcept>
#include <string>
#include <thread>
#include <vector>

// Android Includes
#include <android/input.h>
#include <android/keycodes.h>
#include <android/log.h>
#include <android/native_activity.h>
#include <android_native_app_glue.h>
#include <jni.h>

// Graphics Includes
#include <EGL/egl.h>
#include <GLES3/gl3.h>

// ImGui Includes
#include "imgui.h"
#include "backends/imgui_impl_android.h"
#include "backends/imgui_impl_opengl3.h"

// OpenSSL Includes
#include <openssl/bio.h>
#include <openssl/buffer.h>
#include <openssl/err.h>
#include <openssl/evp.h>
#include <openssl/hmac.h>
#include <openssl/pem.h>
#include <openssl/rand.h>
#include <openssl/ssl.h>
#include <openssl/x509.h>

// Network / JSON Includes
#include "LOGIN/Login.h"
#include "LOGIN/cpr/cpr.h"
#include "LOGIN/json.hpp"

using json = nlohmann::json;

// ============================================================================
// Configuration & Constants
// ============================================================================

#define LOGI(...) __android_log_print(ANDROID_LOG_INFO, "LicenseSystem", __VA_ARGS__)
#define LOGE(...) __android_log_print(ANDROID_LOG_ERROR, "LicenseSystem", __VA_ARGS__)

// IMPORTANT: Change this to your server IP
// For Emulator: "http://10.0.2.2:5001"
// For Real Device: "http://192.168.1.X:5001"
constexpr const char* SERVER_URL = "http://192.168.1.80:5001";
const std::string MASTER_KEY = "ca3695f66cc428a41e6bc8c2ed7ee27b0940fe4da284ae03cc89b89edb35c339";

std::string g_gameName = "PUBG";
std::string g_ProjectId = "9516412833";
android_app* g_App = nullptr;

#ifndef EGL_OPENGL_ES3_BIT_KHR
#define EGL_OPENGL_ES3_BIT_KHR 0x00000040
#endif

// ============================================================================
// Data Structures (Enums & State)
// ============================================================================

enum class LicenseState {
    IDLE,               // Waiting for input
    CHECKING,           // Connecting to server...
    SUCCESS,            // License valid
    ERROR_NOT_FOUND,    // Key not found (404)
    ERROR_EXPIRED,      // Key expired
    ERROR_BANNED,       // Key banned/frozen
    ERROR_NETWORK,      // Network or Server error
    ERROR_FORMAT        // Invalid key format
};

// Result of a single check operation
struct LicenseResult {
    LicenseState state;
    std::string message;
    std::string expiresAt;
    std::string timeLeft;
};

// Global App State (Shared between UI and Worker Thread)
struct AppState {
    std::atomic<LicenseState> currentState{LicenseState::IDLE};
    std::string statusMessage = "Please enter your license key";
    std::string expiresAt;
    std::string timeLeft;

    // Mutex to safely update strings from the background thread
    std::mutex dataMutex;

    // Helper to set error/status
    void setStatus(LicenseState state, const std::string& msg) {
        std::lock_guard<std::mutex> lock(dataMutex);
        currentState = state;
        statusMessage = msg;
    }

    // Helper to set success
    void setSuccess(const std::string& exp, const std::string& time) {
        std::lock_guard<std::mutex> lock(dataMutex);
        currentState = LicenseState::SUCCESS;
        expiresAt = exp;
        timeLeft = time;
        statusMessage = "License Active";
    }
} g_AppState;

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

// Simple XOR for string obfuscation
std::string StrEnc(const char* encrypted, const char* key, size_t length) {
    std::string result;
    result.reserve(length);
    for (size_t i = 0; i < length; ++i) result += static_cast<char>(encrypted[i] ^ key[i]);
    return result;
}

// --- Base64 & AES GCM Encryption Helpers ---
std::string base64_encode(const std::vector<unsigned char>& data) {
    BIO *bio, *b64;
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
    BIO *bio, *b64;
    std::vector<unsigned char> buffer(encoded.size());
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
// JNI Helpers
// ============================================================================

jstring GetAndroidID(JNIEnv* env, jobject context) {
    // In production, use the obfuscated string version here
    jclass contextClass = env->FindClass("android/content/Context");
    jmethodID getContentResolver = env->GetMethodID(contextClass, "getContentResolver", "()Landroid/content/ContentResolver;");
    jclass settingsSecureClass = env->FindClass("android/provider/Settings$Secure");
    jmethodID getString = env->GetStaticMethodID(settingsSecureClass, "getString", "(Landroid/content/ContentResolver;Ljava/lang/String;)Ljava/lang/String;");
    jobject resolver = env->CallObjectMethod(context, getContentResolver);
    return (jstring)env->CallStaticObjectMethod(settingsSecureClass, getString, resolver, env->NewStringUTF("android_id"));
}

jstring GetDeviceModel(JNIEnv* env) {
    jclass buildClass = env->FindClass("android/os/Build");
    jfieldID modelId = env->GetStaticFieldID(buildClass, "MODEL", "Ljava/lang/String;");
    return (jstring)env->GetStaticObjectField(buildClass, modelId);
}

jstring GetDeviceBrand(JNIEnv* env) {
    jclass buildClass = env->FindClass("android/os/Build");
    jfieldID brandId = env->GetStaticFieldID(buildClass, "BRAND", "Ljava/lang/String;");
    return (jstring)env->GetStaticObjectField(buildClass, brandId);
}

// ============================================================================
// API Client (Network Logic)
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
        cpr::Session session = createSession();
        session.SetUrl(std::string(SERVER_URL) + "/api/challenge");
        json j;
        j["user_key"] = user_key;
        j["fingerprint"] = fingerprint;
        j["project_id"] = g_ProjectId;
        session.SetBody(cpr::Body{j.dump()});

        cpr::Response r = session.Post();

        if (r.status_code == 200) {
            try {
                json res = json::parse(r.text);
                std::string challenge;
                if (res.contains("challenge") && res["challenge"].is_string()) {
                    challenge = res["challenge"];
                } else {
                    challenge = "dummy_challenge";
                }
                std::string canary = res.value("canary", "");
                if (res.contains("project_id")) g_ProjectId = std::to_string(res["project_id"].get<int>());
                return challenge + "|" + canary;
            } catch (...) { return ""; }
        }

        if (r.status_code == 404) return "KEY_NOT_FOUND";
        return "SERVER_ERROR_" + std::to_string(r.status_code);
    }

    static std::string connect(const std::string& user_key, const std::string& challenge_data,
                               const std::string& fingerprint, const std::string& game_name,
                               const std::string& android_id, const std::string& model, const std::string& brand) {

        size_t sep = challenge_data.find("|");
        if (sep == std::string::npos) return "ERROR_CHALLENGE_FORMAT";

        std::string challenge = challenge_data.substr(0, sep);
        std::string canary = challenge_data.substr(sep + 1);
        std::string resp_hash = sha256(challenge + user_key + fingerprint);

        json data;
        data["a"] = user_key;
        data["b"] = resp_hash;
        data["c"] = canary;
        data["d"] = fingerprint;
        data["e"] = game_name;
        data["g"] = android_id;
        data["h"] = model;
        data["i"] = brand;
        data["k"] = g_ProjectId;
        data["j"] = random_hex(16);

        std::string blob = encrypt_with_master_key(data.dump(), MASTER_KEY);

        cpr::Session session = createSession();
        session.SetUrl(std::string(SERVER_URL) + "/api/connect");
        json req;
        req["blob"] = blob;
        req["project_id"] = g_ProjectId;
        session.SetBody(cpr::Body{req.dump()});

        cpr::Response r = session.Post();

        if (r.status_code == 200) {
            try {
                std::string decrypted = decrypt_with_master_key(r.text, MASTER_KEY);
                json res = json::parse(decrypted);
                if (res.contains("error")) return "ERROR_SERVER: " + res["error"].get<std::string>();

                std::string exp = res.value("expires_at", "Never");
                std::string left = res.value("seconds_left_human", "Unknown");
                return "VALID|" + exp + "|" + left;
            } catch (const std::exception& e) { return "ERROR_DECRYPT"; }
        }

        if (r.status_code == 403) return "ERROR_BANNED";
        if (r.status_code == 401) return "ERROR_AUTH";
        return "ERROR_HTTP_" + std::to_string(r.status_code);
    }
};

// ============================================================================
// License Checker Logic (Pure C++)
// ============================================================================

class LicenseChecker {
public:
    static std::string sanitizeKey(const std::string& raw) {
        std::string out;
        for (char c : raw) {
            if (isalnum(c) || c == '-') out += std::toupper(c);
        }
        return out;
    }

    static LicenseResult checkLicensePure(std::string key, const char* gameName, JNIEnv* env, jobject context) {
        key = sanitizeKey(key);
        if (key.length() < 5) return {LicenseState::ERROR_FORMAT, "Key is too short", "", ""};

        std::string aid = getAndroidId(env, context);
        std::string model = getDeviceModel(env);
        std::string brand = getDeviceBrand(env);
        std::string fingerprint = sha256(aid + "-" + model + "-" + brand);

        // 1. Get Challenge
        std::string challenge = ApiClient::getChallenge(key, fingerprint);
        if (challenge == "KEY_NOT_FOUND") return {LicenseState::ERROR_NOT_FOUND, "Key not found", "", ""};
        if (challenge.find("SERVER_ERROR") != std::string::npos) return {LicenseState::ERROR_NETWORK, "Server Error: " + challenge, "", ""};
        if (challenge.empty()) return {LicenseState::ERROR_NETWORK, "Empty response from server", "", ""};

        // 2. Connect
        std::string res = ApiClient::connect(key, challenge, fingerprint, gameName, aid, model, brand);

        if (res.find("VALID|") == 0) {
            size_t p1 = res.find('|');
            size_t p2 = res.find('|', p1 + 1);
            std::string exp = (p2 != std::string::npos) ? res.substr(p1+1, p2-p1-1) : "Unknown";
            std::string left = (p2 != std::string::npos) ? res.substr(p2+1) : "";
            return {LicenseState::SUCCESS, "Success", exp, left};
        }

        if (res.find("BANNED") != std::string::npos) return {LicenseState::ERROR_BANNED, "License is banned", "", ""};
        return {LicenseState::ERROR_NETWORK, "Verification failed: " + res, "", ""};
    }

private:
    static std::string getAndroidId(JNIEnv* env, jobject ctx) {
        jstring js = GetAndroidID(env, ctx);
        const char* c = env->GetStringUTFChars(js, 0);
        std::string s = c ? c : "unknown";
        if(c) env->ReleaseStringUTFChars(js, c);
        return s;
    }
    static std::string getDeviceModel(JNIEnv* env) {
        jstring js = GetDeviceModel(env);
        const char* c = env->GetStringUTFChars(js, 0);
        std::string s = c ? c : "unknown";
        if(c) env->ReleaseStringUTFChars(js, c);
        return s;
    }
    static std::string getDeviceBrand(JNIEnv* env) {
        jstring js = GetDeviceBrand(env);
        const char* c = env->GetStringUTFChars(js, 0);
        std::string s = c ? c : "unknown";
        if(c) env->ReleaseStringUTFChars(js, c);
        return s;
    }
};

// ============================================================================
// CheckLicense Function (JNI Wrapper)
// ============================================================================

std::string CheckLicense(const char* user_key, const char* game_name, JNIEnv* env, jobject context, const char* ca_path) {
    // ca_path parameter is currently unused but kept for API compatibility
    LicenseResult result = LicenseChecker::checkLicensePure(std::string(user_key), game_name, env, context);
    
    // Convert LicenseResult to string format
    switch (result.state) {
        case LicenseState::SUCCESS:
            return "SUCCESS|" + result.expiresAt + "|" + result.timeLeft;
        case LicenseState::ERROR_NOT_FOUND:
            return "ERROR_NOT_FOUND|" + result.message;
        case LicenseState::ERROR_EXPIRED:
            return "ERROR_EXPIRED|" + result.message;
        case LicenseState::ERROR_BANNED:
            return "ERROR_BANNED|" + result.message;
        case LicenseState::ERROR_NETWORK:
            return "ERROR_NETWORK|" + result.message;
        case LicenseState::ERROR_FORMAT:
            return "ERROR_FORMAT|" + result.message;
        default:
            return "ERROR_UNKNOWN|" + result.message;
    }
}

// ============================================================================
// Main Application
// ============================================================================

struct EGLObjects { EGLDisplay display; EGLSurface surface; EGLContext context; };

static EGLObjects init_egl(ANativeWindow* window) {
    EGLObjects egl;
    egl.display = eglGetDisplay(EGL_DEFAULT_DISPLAY);
    eglInitialize(egl.display, 0, 0);
    const EGLint attribs[] = { EGL_RENDERABLE_TYPE, EGL_OPENGL_ES3_BIT_KHR, EGL_SURFACE_TYPE, EGL_WINDOW_BIT, EGL_BLUE_SIZE, 8, EGL_GREEN_SIZE, 8, EGL_RED_SIZE, 8, EGL_NONE };
    EGLConfig config; EGLint numConfigs;
    eglChooseConfig(egl.display, attribs, &config, 1, &numConfigs);
    egl.surface = eglCreateWindowSurface(egl.display, config, window, 0);
    const EGLint ctxAttr[] = { EGL_CONTEXT_CLIENT_VERSION, 3, EGL_NONE };
    egl.context = eglCreateContext(egl.display, config, EGL_NO_CONTEXT, ctxAttr);
    eglMakeCurrent(egl.display, egl.surface, egl.surface, egl.context);
    return egl;
}

void android_main(struct android_app* app) {
    g_App = app;
    app->onAppCmd = [](android_app* app, int32_t cmd) { /* Handle Lifecycle */ };
    app->onInputEvent = [](android_app* app, AInputEvent* event) { return ImGui_ImplAndroid_HandleInputEvent(event); };

    while (!app->window) {
        int events; android_poll_source* source;
        while (ALooper_pollOnce(0, 0, &events, (void**)&source) >= 0) if (source) source->process(app, source);
    }

    EGLObjects egl = init_egl(app->window);

    // ImGui Init
    IMGUI_CHECKVERSION();
    ImGui::CreateContext();
    ImGuiIO& io = ImGui::GetIO();
    io.IniFilename = nullptr; // Don't save settings
    ImGui::StyleColorsDark();
    ImGui::GetStyle().ScaleAllSizes(3.0f); // Scale UI for HighDPI screens
    io.FontGlobalScale = 1.0f;

    ImGui_ImplAndroid_Init(app->window);
    ImGui_ImplOpenGL3_Init("#version 300 es");

    char inputBuffer[64] = "";

    while (true) {
        int events; android_poll_source* source;
        while (ALooper_pollOnce(0, 0, &events, (void**)&source) >= 0) {
            if (source) source->process(app, source);
            if (app->destroyRequested) goto cleanup;
        }

        ImGui_ImplOpenGL3_NewFrame();
        ImGui_ImplAndroid_NewFrame();
        ImGui::NewFrame();

        int w = ANativeWindow_getWidth(app->window);
        int h = ANativeWindow_getHeight(app->window);

        // --- UI RENDER LOGIC ---

        // Get thread-safe copy of the state
        LicenseState currentState;
        std::string currentMsg, currentExp, currentTime;
        {
            std::lock_guard<std::mutex> lock(g_AppState.dataMutex);
            currentState = g_AppState.currentState;
            currentMsg = g_AppState.statusMessage;
            currentExp = g_AppState.expiresAt;
            currentTime = g_AppState.timeLeft;
        }

        if (currentState != LicenseState::SUCCESS) {
            // == LOGIN WINDOW ==
            ImGui::SetNextWindowPos(ImVec2(w * 0.5f, h * 0.5f), ImGuiCond_Always, ImVec2(0.5f, 0.5f));
            ImGui::SetNextWindowSize(ImVec2(w * 0.9f, 0)); // 90% screen width

            if (ImGui::Begin("Login##Window", nullptr, ImGuiWindowFlags_NoDecoration | ImGuiWindowFlags_NoMove)) {

                ImGui::TextColored(ImVec4(0, 0.8f, 1, 1), "ACTIVATION REQUIRED");
                ImGui::Separator();
                ImGui::Spacing();

                bool isChecking = (currentState == LicenseState::CHECKING);

                ImGui::BeginDisabled(isChecking);
                ImGui::Text("License Key:");
                ImGui::InputText("##key", inputBuffer, sizeof(inputBuffer), ImGuiInputTextFlags_CharsUppercase);
                ImGui::EndDisabled();

                ImGui::Spacing();

                if (isChecking) {
                    ImGui::Button("Connecting...", ImVec2(-1, 0)); // Full width
                    ImGui::ProgressBar(ImGui::GetTime() * -0.5f, ImVec2(-1, 5));
                } else {
                    if (ImGui::Button("VERIFY KEY", ImVec2(-1, 100))) { // Large button
                        std::string keyCopy = inputBuffer;

                        // Update UI state
                        g_AppState.setStatus(LicenseState::CHECKING, "Connecting to server...");

                        // === START BACKGROUND THREAD ===
                        std::thread([keyCopy, app]() {
                            // 1. Attach thread to Java VM
                            JNIEnv* env = nullptr;
                            JavaVM* vm = app->activity->vm;
                            vm->AttachCurrentThread(&env, nullptr);

                            // 2. Perform heavy network task
                            LicenseResult res = LicenseChecker::checkLicensePure(
                                    keyCopy, g_gameName.c_str(), env, app->activity->clazz
                            );

                            // 3. Update UI (Thread-Safe)
                            if (res.state == LicenseState::SUCCESS) {
                                g_AppState.setSuccess(res.expiresAt, res.timeLeft);
                            } else {
                                g_AppState.setStatus(res.state, res.message);
                            }

                            // 4. Detach thread
                            vm->DetachCurrentThread();
                        }).detach();
                    }
                }

                ImGui::Spacing();
                ImGui::Separator();

                // Status Color Logic
                ImVec4 col = ImVec4(1, 1, 1, 1); // White
                if (currentState == LicenseState::ERROR_NOT_FOUND) col = ImVec4(1, 0.3f, 0.3f, 1); // Red
                else if (currentState == LicenseState::ERROR_BANNED) col = ImVec4(1, 0, 0, 1); // Red
                else if (currentState == LicenseState::ERROR_EXPIRED) col = ImVec4(1, 0.6f, 0, 1); // Orange

                ImGui::TextColored(col, "%s", currentMsg.c_str());
            }
            ImGui::End();

        } else {
            // == MAIN MENU (AFTER SUCCESS) ==
            ImGui::SetNextWindowPos(ImVec2(w * 0.5f, h * 0.5f), ImGuiCond_Always, ImVec2(0.5f, 0.5f));
            if (ImGui::Begin("Menu##Window", nullptr, ImGuiWindowFlags_NoDecoration | ImGuiWindowFlags_AlwaysAutoResize)) {

                ImGui::TextColored(ImVec4(0.2f, 1.0f, 0.2f, 1.0f), "ACCESS GRANTED");
                ImGui::Separator();
                ImGui::Text("Expires: %s", currentExp.c_str());
                ImGui::Text("Time Left: %s", currentTime.c_str());
                ImGui::Spacing();

                if (ImGui::Button("LAUNCH GAME", ImVec2(400, 100))) {
                    LOGI("Game Launched!");
                    // Launch game logic here
                }

                ImGui::Spacing();

                if (ImGui::Button("Log Out", ImVec2(400, 60))) {
                    g_AppState.setStatus(LicenseState::IDLE, "Please enter your license key");
                    memset(inputBuffer, 0, sizeof(inputBuffer));
                }
            }
            ImGui::End();
        }

        ImGui::Render();
        glViewport(0, 0, w, h);
        glClearColor(0.1f, 0.1f, 0.12f, 1.0f);
        glClear(GL_COLOR_BUFFER_BIT);
        ImGui_ImplOpenGL3_RenderDrawData(ImGui::GetDrawData());
        eglSwapBuffers(egl.display, egl.surface);
    }

    cleanup:
    ImGui_ImplOpenGL3_Shutdown();
    ImGui_ImplAndroid_Shutdown();
    ImGui::DestroyContext();
}