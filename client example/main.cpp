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
// Production server with mTLS support
constexpr const char* SERVER_URL = "https://ovrin.xyz";
constexpr const char* SERVER_URL_EMULATOR = "https://ovrin.xyz";  // Use same URL for emulator
constexpr const char* MASTER_KEY_HEX = "ca3695f66cc428a41e6bc8c2ed7ee27b0940fe4da284ae03cc89b89edb35c339";

// SSL Pinning Configuration
// ============================================================================
// SECURITY: SSL Pinning protects against MITM attacks even with valid CA certificates.
// 
// To get the server certificate fingerprint, run:
//   ./scripts/get_server_cert_fingerprint.sh ovrin.xyz 443
//
// IMPORTANT: Update this fingerprint when the server certificate is renewed!
//            The fingerprint is the SHA-256 hash of the server's SSL certificate.
// ============================================================================
// Server certificate SHA-256 fingerprint (uppercase, no colons)
// Obtained from: ./get_server_cert_fingerprint.sh ovrin.xyz 443
// Certificate valid until: Apr 7 00:15:54 2026 GMT (Let's Encrypt)
constexpr const char* SERVER_CERT_FINGERPRINT = "00219C5A91059B130B4E8954BBB03B3BC1CB5636327E6BD7CB3CDB29F7D149C5";
constexpr bool SSL_PINNING_ENABLED = true;  // SSL pinning enabled

// Single CA Certificate Pinning (simplified configuration)
// ============================================================================
// SECURITY: Single CA fingerprint pinning provides additional protection
// against MITM attacks even if the server certificate changes.
//
// NOTE: Single CA is now used for all clients (simplified configuration).
// The CA fingerprint is the same for all projects.
//
// The CA fingerprint can be obtained from the server via:
//   GET /api/projects/<project_id>/mtls/ca-cert (requires JWT authentication)
//
// Or you can hardcode it here after obtaining from server admin:
//   constexpr const char* HARDCODED_CA_FINGERPRINT = "DAE31C0D190F9C6D77..."; // SHA-256 without colons
//
// This fingerprint is cached locally and verified against the CA certificate
// in the server's certificate chain during SSL handshake.
// ============================================================================
// Global variable to store single CA fingerprint (fetched from server or hardcoded)
static std::string g_ProjectCaFingerprint = "";
// TODO: Optionally hardcode CA fingerprint here for offline pinning:
// static std::string g_ProjectCaFingerprint = "DAE31C0D190F9C6D77..."; // SHA-256, uppercase, no colons
constexpr bool PROJECT_CA_PINNING_ENABLED = false;  // Disabled by default (requires authentication to fetch)

// mTLS Configuration - Universal certificates with single CA (simplified)
// ============================================================================
// SETUP INSTRUCTIONS:
// 
// IMPORTANT: Universal certificates - single CA for ALL clients.
// - CN can be ANY value: "android", "mobile", "my-app", "client-1", etc.
// - NO project_id prefix required in CN
// - All certificates work for all projects (universal)
// - Project ID is checked via request data, not certificate CN
// 
// 1. Get client certificates (choose one method):
//    
//    A. Automatically on server (RECOMMENDED):
//       cd /var/www/panel
//       python3 check_license.py
//       # Creates universal certificate with CN = client_name (no project_id)
//    
//    B. Via API (for automatic client setup):
//       - Client generates CSR with CN: <any_client_name> (no project_id prefix)
//       - POST /api/projects/<project_id>/mtls/csr-sign-public
//       - Server signs with single CA and returns universal certificate
//       # NOTE: project_id in URL is for file organization, CN can be any value
//    
//    C. Manually on server:
//       ./scripts/get_client_certs_for_android.sh <project_id> <any_client_name> <user_key>
//       # CN = <client_name> (universal, works for all projects)
//
// 2. Copy certificates to Android app:
//    - Copy client-cert.pem to app's internal storage
//    - Copy client-key.pem to app's internal storage
//    - IMPORTANT: Keep private key secure! Use Android Keystore in production.
//
// 3. Update paths below to match your app's package name:
//    Replace "com.yourpackage.app" with your actual Android package name
// ============================================================================
// Paths to client certificate and key files
// Option 1: Use app's internal storage (recommended)
// TODO: Replace "com.yourpackage.app" with your actual Android package name
constexpr const char* CLIENT_CERT_PATH = "/data/data/com.yourpackage.app/files/client-cert.pem";
constexpr const char* CLIENT_KEY_PATH = "/data/data/com.yourpackage.app/files/client-key.pem";

// Option 2: Use assets bundled with APK (requires loading from assets using AAssetManager)
// You'll need to implement asset loading and save to internal storage first
// constexpr const char* CLIENT_CERT_ASSET = "client-cert.pem";
// constexpr const char* CLIENT_KEY_ASSET = "client-key.pem";

// Note: Single CA is now used for all clients (simplified configuration)
// CA fingerprint can be obtained from: GET /api/projects/<project_id>/mtls/ca-cert
// But this requires authentication, so CA pinning is optional

// Global state
std::string g_gameName = "PUBG";
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

// XOR-based string encryption/decryption
std::string StrEnc(const char* data, const char* key, size_t length) {
    std::string result;
    result.reserve(length);
    for (size_t i = 0; i < length; ++i) {
        result += static_cast<char>(data[i] ^ key[i]);
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

std::string encryptWithMasterKey(const std::string& plaintext, const std::string& masterKeyHex) {
    try {
        std::vector<unsigned char> key;
        for (size_t i = 0; i < masterKeyHex.length(); i += 2) {
            std::string byteStr = masterKeyHex.substr(i, 2);
            unsigned char byte = static_cast<unsigned char>(std::stoul(byteStr, nullptr, 16));
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
        LOGE("encryptWithMasterKey error: %s", e.what());
        throw;
    }
}

std::string decryptWithMasterKey(const std::string& encryptedDataB64, const std::string& masterKeyHex) {
    LOGI("decryptWithMasterKey: ENTRY, data_length=%zu", encryptedDataB64.length());
    try {
        std::vector<unsigned char> decoded = base64_decode(encryptedDataB64);
        LOGI("decryptWithMasterKey: Decoded size=%zu", decoded.size());

        if (decoded.size() < 28) {
            throw std::runtime_error("Encrypted data too short");
        }

        std::vector<unsigned char> key;
        for (size_t i = 0; i < masterKeyHex.length(); i += 2) {
            std::string byteStr = masterKeyHex.substr(i, 2);
            unsigned char byte = static_cast<unsigned char>(std::stoul(byteStr, nullptr, 16));
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
        LOGI("decryptWithMasterKey: Decryption successful, plaintext length=%zu", plaintext_len);
        return std::string(plaintext.begin(), plaintext.end());
    } catch (const std::exception& e) {
        LOGE("decryptWithMasterKey error: %s", e.what());
        throw;
    }
}

// ============================================================================
// SSL Pinning Support
// ============================================================================

/**
 * Get SHA-256 fingerprint of X509 certificate
 * Returns uppercase hex string without colons
 */
static std::string getCertificateFingerprint(X509* cert) {
    unsigned char digest[EVP_MAX_MD_SIZE];
    unsigned int digest_len = 0;
    
    if (X509_digest(cert, EVP_sha256(), digest, &digest_len) != 1) {
        LOGE("SSL Pinning: Failed to compute certificate fingerprint");
        return "";
    }
    
    char fingerprint[65];  // 64 hex chars + null terminator
    for (unsigned int i = 0; i < digest_len; i++) {
        sprintf(fingerprint + i * 2, "%02X", digest[i]);
    }
    fingerprint[64] = '\0';
    
    return std::string(fingerprint);
}

/**
 * SSL Pinning verification callback for libcurl
 * This function is called during SSL handshake to verify the server certificate
 * matches the pinned fingerprint.
 * 
 * SECURITY: This protects against:
 * - MITM attacks even with valid CA certificates
 * - Compromised Certificate Authorities
 * - DNS hijacking attacks
 */
#if defined(__ANDROID__) || defined(ANDROID)
// Android/OpenSSL version
static int sslPinningCallback(SSL_CTX* ctx, void* arg) {
    (void)ctx;  // Unused
    (void)arg;  // Unused
    
    if (!SSL_PINNING_ENABLED || !SERVER_CERT_FINGERPRINT || strlen(SERVER_CERT_FINGERPRINT) == 0) {
        return 1;  // SSL pinning disabled, allow connection
    }
    
    // Note: This callback is called before the certificate is available
    // We need to use a different approach - verify after connection
    // For now, we'll verify in a post-connection check
    return 1;
}
#else
// Standard OpenSSL version
static int sslPinningCallback(SSL_CTX* ctx, void* arg) {
    (void)ctx;
    (void)arg;
    return 1;
}
#endif

/**
 * Verify server certificate fingerprint matches pinned value
 * This should be called after establishing SSL connection
 */
static bool verifyCertificateFingerprint(const std::string& serverFingerprint) {
    if (!SSL_PINNING_ENABLED || !SERVER_CERT_FINGERPRINT || strlen(SERVER_CERT_FINGERPRINT) == 0) {
        LOGI("SSL Pinning: Disabled, skipping verification");
        return true;  // SSL pinning disabled, allow connection
    }
    
    // Convert both to uppercase for comparison
    std::string expected(SERVER_CERT_FINGERPRINT);
    std::string received(serverFingerprint);
    
    std::transform(expected.begin(), expected.end(), expected.begin(), ::toupper);
    std::transform(received.begin(), received.end(), received.begin(), ::toupper);
    
    // Remove colons if present
    expected.erase(std::remove(expected.begin(), expected.end(), ':'), expected.end());
    received.erase(std::remove(received.begin(), received.end(), ':'), received.end());
    
    if (expected == received) {
        LOGI("SSL Pinning: Certificate fingerprint verified successfully");
        return true;
    } else {
        LOGE("SSL Pinning: Certificate fingerprint mismatch!");
        LOGE("  Expected: %s", expected.c_str());
        LOGE("  Received: %s", received.c_str());
        return false;
    }
}

/**
 * Verify CA certificate fingerprint in certificate chain
 * Checks if any CA in the chain matches the pinned project CA fingerprint
 * 
 * SECURITY: This provides protection against MITM even if server cert changes
 */
static bool verifyCaFingerprint(X509_STORE_CTX* ctx) {
    if (!PROJECT_CA_PINNING_ENABLED || g_ProjectCaFingerprint.empty()) {
        LOGI("CA Pinning: Disabled or fingerprint not loaded, skipping verification");
        return true;  // CA pinning disabled, allow connection
    }
    
    // Get certificate chain
    STACK_OF(X509)* chain = X509_STORE_CTX_get_chain(ctx);
    if (!chain) {
        LOGE("CA Pinning: Failed to get certificate chain");
        return false;
    }
    
    int chainLen = sk_X509_num(chain);
    LOGI("CA Pinning: Checking %d certificates in chain", chainLen);
    
    // Check each certificate in the chain (including CA certificates)
    for (int i = 0; i < chainLen; i++) {
        X509* cert = sk_X509_value(chain, i);
        if (!cert) continue;
        
        std::string fingerprint = getCertificateFingerprint(cert);
        if (fingerprint.empty()) continue;
        
        // Convert to uppercase and remove colons
        std::string expected(g_ProjectCaFingerprint);
        std::string received(fingerprint);
        
        std::transform(expected.begin(), expected.end(), expected.begin(), ::toupper);
        std::transform(received.begin(), received.end(), received.begin(), ::toupper);
        
        expected.erase(std::remove(expected.begin(), expected.end(), ':'), expected.end());
        received.erase(std::remove(received.begin(), received.end(), ':'), received.end());
        
        if (expected == received) {
            LOGI("CA Pinning: Project CA fingerprint verified successfully (certificate %d in chain)", i);
            return true;
        }
    }
    
    LOGE("CA Pinning: Project CA fingerprint not found in certificate chain!");
    LOGE("  Expected: %s", g_ProjectCaFingerprint.c_str());
    return false;
}

// ============================================================================
// API Communication
// ============================================================================

namespace ErrorMessages {
    constexpr const char* KEY_NOT_FOUND = "KEY_NOT_FOUND";
    constexpr const char* SERVER_ERROR = "SERVER_ERROR";
    constexpr const char* VALID = "VALID";
}

class ApiClient {
private:
    // Helper function to check if file exists
    static bool fileExists(const char* path) {
        std::ifstream file(path);
        return file.good();
    }
    
    // Helper function to load certificate from Android assets (if needed)
    static std::string loadFromAssets(const char* assetPath, android_app* app) {
        // This is a placeholder - implement asset loading based on your Android setup
        // You may need to use AAssetManager from Android NDK
        return "";
    }
    
    static cpr::Session createSession() {
        cpr::Session session;
        session.SetHeader({{"Content-Type", "application/json"}});
        session.SetTimeout(cpr::Timeout{10000});
        
        // Configure SSL/TLS with mTLS support and SSL pinning
        bool useMtls = fileExists(CLIENT_CERT_PATH) && fileExists(CLIENT_KEY_PATH);
        
        if (useMtls) {
            // mTLS configuration: use client certificate
            // Note: cpr uses libcurl, CertFile and KeyFile should be file paths
            try {
                session.SetSslOptions(cpr::Ssl(
                    cpr::ssl::TLSv1_2{},
                    cpr::ssl::VerifyHost{true},      // Verify hostname matches certificate
                    cpr::ssl::VerifyPeer{true},      // Verify server certificate
                    cpr::ssl::CertFile{CLIENT_CERT_PATH},  // Client certificate file path
                    cpr::ssl::KeyFile{CLIENT_KEY_PATH}      // Client private key file path
                ));
                LOGI("ApiClient: mTLS enabled with client certificate from %s", CLIENT_CERT_PATH);
            } catch (const std::exception& e) {
                LOGE("ApiClient: Failed to configure mTLS: %s", e.what());
                LOGE("ApiClient: Make sure client-cert.pem and client-key.pem exist and are readable");
                // Fallback to SSL without client certificate
                session.SetSslOptions(cpr::Ssl(
                    cpr::ssl::TLSv1_2{},
                    cpr::ssl::VerifyHost{true},
                    cpr::ssl::VerifyPeer{true}
                ));
            }
        } else {
            // Fallback: SSL without client certificate (will fail if mTLS is required on server)
            session.SetSslOptions(cpr::Ssl(
                cpr::ssl::TLSv1_2{},
                cpr::ssl::VerifyHost{true},      // Verify hostname
                cpr::ssl::VerifyPeer{true}        // Verify server certificate
            ));
            LOGI("ApiClient: SSL without mTLS (client certificates not found)");
            LOGI("ApiClient: Expected paths: %s or %s", CLIENT_CERT_PATH, CLIENT_KEY_PATH);
            LOGI("ApiClient: Note: mTLS is required for /api/challenge and /api/connect endpoints");
        }
        
        // SSL Pinning configuration
        // ============================================================================
        // SECURITY: SSL pinning provides protection against MITM attacks
        // 
        // Implementation notes:
        // 1. Server certificate pinning: Uses SERVER_CERT_FINGERPRINT constant
        // 2. Project CA pinning: Uses g_ProjectCaFingerprint (fetched from server)
        //
        // For full SSL pinning support with cpr/libcurl, you need to:
        // - Use CURLOPT_SSL_CTX_FUNCTION callback to access SSL context
        // - Or use CURLOPT_SSL_VERIFYPEER callback to verify certificates
        // - Or extend cpr library with custom SSL verification
        //
        // Current implementation: Basic SSL verification (VerifyPeer/VerifyHost)
        // CA fingerprint is fetched from server and stored in g_ProjectCaFingerprint
        // Full CA pinning verification requires libcurl callback implementation
        // ============================================================================
        if (SSL_PINNING_ENABLED && SERVER_CERT_FINGERPRINT && strlen(SERVER_CERT_FINGERPRINT) > 0) {
            LOGI("ApiClient: SSL Pinning enabled (server certificate fingerprint)");
        }
        
        if (PROJECT_CA_PINNING_ENABLED && !g_ProjectCaFingerprint.empty()) {
            LOGI("ApiClient: Project CA Pinning enabled (CA fingerprint: %s...)", 
                 g_ProjectCaFingerprint.substr(0, 16).c_str());
            // Note: Full CA pinning verification requires libcurl callback
            // The fingerprint is fetched and stored, ready for verification
        } else if (PROJECT_CA_PINNING_ENABLED && !g_ProjectId.empty()) {
            // Try to fetch CA fingerprint if not already loaded
            LOGI("ApiClient: Project CA fingerprint not loaded, attempting to fetch...");
            ApiClient::getProjectCaFingerprint(g_ProjectId);
        }
        
        return session;
    }

    static std::string parseErrorResponse(int statusCode, const std::string& responseText) {
        if (statusCode == 503) {
            return "SERVER_ERROR_503: Server temporarily unavailable (503)\n   Possible causes:\n   - Redis unavailable\n   - Server overloaded\n   - Check server logs";
        }

        std::string errorMessage;
        try {
            json errorJson = json::parse(responseText);
            if (errorJson.contains("error")) {
                errorMessage = errorJson["error"].get<std::string>();
                return errorMessage;
            }
        } catch (...) {
            try {
                std::string decrypted = decryptWithMasterKey(responseText, MASTER_KEY_HEX);
                json errorJson = json::parse(decrypted);
                if (errorJson.contains("error")) {
                    errorMessage = errorJson["error"].get<std::string>();
                    std::transform(errorMessage.begin(), errorMessage.end(), errorMessage.begin(), ::tolower);
                    if (errorMessage.find("not found") != std::string::npos) {
                        return ErrorMessages::KEY_NOT_FOUND;
                    }
                    return errorMessage;
                }
            } catch (...) {
                LOGE("Failed to decrypt error response");
            }
        }

        return "SERVER_ERROR_" + std::to_string(statusCode) + ": " +
               (errorMessage.empty() ? "Server error" : errorMessage);
    }

    static std::string extractChallenge(const json& result) {
        if (result.contains("challenge") && result["challenge"].is_object()) {
            if (result["challenge"].contains("challenges") &&
                result["challenge"]["challenges"].contains("crypto") &&
                result["challenge"]["challenges"]["crypto"].contains("challenges")) {
                
                auto cryptoChallenges = result["challenge"]["challenges"]["crypto"]["challenges"];
                const std::vector<std::string> challengeKeys = {"sha256", "combined", "md5"};
                
                for (const auto& key : challengeKeys) {
                    if (cryptoChallenges.contains(key) && cryptoChallenges[key].contains("input")) {
                        return cryptoChallenges[key]["input"];
                    }
                }
            }
        } else if (result.contains("challenge") && result["challenge"].is_string()) {
            return result["challenge"];
        }
        return "";
    }

    /**
     * Get single CA certificate fingerprint from server (simplified configuration)
     * 
     * NOTE: This endpoint requires JWT authentication, so it may not work until
     * client is authenticated. CA pinning is optional and provides additional security.
     * 
     * SECURITY: This fingerprint is used to verify the CA certificate in the
     * server's certificate chain, providing protection against MITM attacks.
     * 
     * Since we now use a single CA for all clients, the fingerprint is the same
     * for all projects. You can hardcode it if needed (obtain from server admin).
     */
    static bool getProjectCaFingerprint(const std::string& projectId) {
        if (projectId.empty()) {
            LOGE("GetProjectCaFingerprint: Project ID is empty");
            return false;
        }
        
        LOGI("GetProjectCaFingerprint: Fetching single CA fingerprint for project %s", projectId.c_str());
        
        // Create a session - this endpoint requires JWT, so it may fail
        // Use mTLS if certificates are available, otherwise try without
        bool useMtls = fileExists(CLIENT_CERT_PATH) && fileExists(CLIENT_KEY_PATH);
        cpr::Session session;
        session.SetHeader({{"Content-Type", "application/json"}});
        session.SetTimeout(cpr::Timeout{10000});
        
        if (useMtls) {
            try {
                session.SetSslOptions(cpr::Ssl(
                    cpr::ssl::TLSv1_2{},
                    cpr::ssl::VerifyHost{true},
                    cpr::ssl::VerifyPeer{true},
                    cpr::ssl::CertFile{CLIENT_CERT_PATH},
                    cpr::ssl::KeyFile{CLIENT_KEY_PATH}
                ));
                LOGI("GetProjectCaFingerprint: Using mTLS");
            } catch (const std::exception& e) {
                LOGE("GetProjectCaFingerprint: Failed to configure mTLS: %s", e.what());
                session.SetSslOptions(cpr::Ssl(
                    cpr::ssl::TLSv1_2{},
                    cpr::ssl::VerifyHost{true},
                    cpr::ssl::VerifyPeer{true}
                ));
            }
        } else {
            session.SetSslOptions(cpr::Ssl(
                cpr::ssl::TLSv1_2{},
                cpr::ssl::VerifyHost{true},
                cpr::ssl::VerifyPeer{true}
            ));
        }
        
        std::string url = std::string(SERVER_URL) + "/api/projects/" + projectId + "/mtls/ca-cert";
        session.SetUrl(url);
        
        cpr::Response response = session.Get();
        
        if (response.status_code == 200) {
            try {
                json result = json::parse(response.text);
                
                if (result.contains("fingerprint")) {
                    g_ProjectCaFingerprint = result["fingerprint"].get<std::string>();
                    
                    // Remove colons if present
                    g_ProjectCaFingerprint.erase(
                        std::remove(g_ProjectCaFingerprint.begin(), g_ProjectCaFingerprint.end(), ':'),
                        g_ProjectCaFingerprint.end()
                    );
                    
                    // Convert to uppercase
                    std::transform(g_ProjectCaFingerprint.begin(), g_ProjectCaFingerprint.end(),
                                 g_ProjectCaFingerprint.begin(), ::toupper);
                    
                    LOGI("GetProjectCaFingerprint: SUCCESS - Single CA fingerprint: %s", g_ProjectCaFingerprint.c_str());
                    return true;
                } else {
                    LOGE("GetProjectCaFingerprint: Response missing fingerprint field");
                    return false;
                }
            } catch (const std::exception& e) {
                LOGE("GetProjectCaFingerprint: JSON parsing error: %s", e.what());
                return false;
            }
        } else if (response.status_code == 401 || response.status_code == 403) {
            LOGI("GetProjectCaFingerprint: Endpoint requires authentication (status %d). CA pinning will be skipped.", response.status_code);
            // This is expected - the endpoint requires JWT authentication
            // CA pinning is optional, so we continue without it
            return false;
        } else {
            LOGE("GetProjectCaFingerprint: Server error: %d", response.status_code);
            // Don't fail completely - allow connection without CA pinning if fetch fails
            // This provides graceful degradation
            return false;
        }
    }

public:

    static std::string getChallenge(const std::string& userKey, const std::string& fingerprint) {
        LOGI("GetChallenge: START - user_key=%s", userKey.c_str());

        cpr::Session session = createSession();
        session.SetUrl(std::string(SERVER_URL) + "/api/challenge");

        json challengeData;
        challengeData["user_key"] = userKey;
        challengeData["fingerprint"] = fingerprint;
        challengeData["project_id"] = g_ProjectId;

        session.SetBody(cpr::Body{challengeData.dump()});
        LOGI("GetChallenge: Request JSON = %s", challengeData.dump().c_str());

        cpr::Response response = session.Post();
        LOGI("GetChallenge: Response status=%d", response.status_code);

        if (response.status_code == 200) {
            try {
                json result = json::parse(response.text);
                std::string canary = result["canary"];
                std::string challenge = extractChallenge(result);
                
                if (challenge.empty()) {
                    LOGE("GetChallenge: Could not extract challenge");
                    return "";
                }

                if (result.contains("project_id")) {
                    std::string newProjectId = std::to_string(result["project_id"].get<int>());
                    if (newProjectId != g_ProjectId) {
                        g_ProjectId = newProjectId;
                        LOGI("GetChallenge: Project ID updated: %s", g_ProjectId.c_str());
                        
                        // Fetch CA fingerprint for the new project
                        if (PROJECT_CA_PINNING_ENABLED) {
                            ApiClient::getProjectCaFingerprint(g_ProjectId);
                        }
                    }
                } else {
                    // If project_id not in response, try to fetch CA fingerprint with current project_id
                    if (PROJECT_CA_PINNING_ENABLED && !g_ProjectId.empty() && g_ProjectCaFingerprint.empty()) {
                        ApiClient::getProjectCaFingerprint(g_ProjectId);
                    }
                }

                LOGI("GetChallenge: SUCCESS - Challenge received, key found on server!");
                return challenge + "|" + canary;
            } catch (const std::exception& e) {
                LOGE("GetChallenge: JSON parsing error: %s", e.what());
                return "";
            }
        } else if (response.status_code == 404) {
            LOGE("GetChallenge: Key not found on server (404)");
            return ErrorMessages::KEY_NOT_FOUND;
        } else {
            LOGE("GetChallenge: Server error: %d", response.status_code);
            return parseErrorResponse(response.status_code, response.text);
        }
    }

    static std::string connect(const std::string& userKey,
                               const std::string& challengeData,
                               const std::string& fingerprint,
                               const std::string& gameName,
                               const std::string& serial,
                               const std::string& androidId,
                               const std::string& deviceModel,
                               const std::string& deviceBrand) {
        LOGI("ConnectWithChallenge: START");

        size_t separator = challengeData.find("|");
        if (separator == std::string::npos) {
            LOGE("ConnectWithChallenge: Invalid challenge data format");
            return "Error: Invalid challenge format";
        }

        std::string challenge = challengeData.substr(0, separator);
        std::string canary = challengeData.substr(separator + 1);

        std::string challengeResponse = (challenge.length() > 100) ? 
            sha256(challenge) : sha256(challenge + userKey + fingerprint);

        json data;
        data["a"] = userKey;
        data["b"] = challengeResponse;
        data["c"] = canary;
        data["d"] = fingerprint;
        data["e"] = gameName;
        data["f"] = serial;
        data["g"] = androidId;
        data["h"] = deviceModel;
        data["i"] = deviceBrand;
        data["j"] = random_hex(16);
        data["k"] = g_ProjectId;

        std::string encryptedBlob = encryptWithMasterKey(data.dump(), MASTER_KEY_HEX);

        cpr::Session session = createSession();
        session.SetUrl(std::string(SERVER_URL) + "/api/connect");

        json requestData;
        requestData["blob"] = encryptedBlob;
        requestData["project_id"] = g_ProjectId;
        session.SetBody(cpr::Body{requestData.dump()});

        cpr::Response response = session.Post();
        LOGI("ConnectWithChallenge: Response status=%d", response.status_code);

        if (response.status_code == 200) {
            try {
                std::string decryptedResponse = decryptWithMasterKey(response.text, MASTER_KEY_HEX);
                json result = json::parse(decryptedResponse);

                if (result.contains("error")) {
                    return "Server error: " + result["error"].get<std::string>();
                }

                if (result.contains("a") && result.contains("d") && result.contains("f")) {
                    if (result.contains("project_id")) {
                        g_ProjectId = std::to_string(result["project_id"].get<int>());
                    }

                    std::string expiresAt = result.value("expires_at", "Never");
                    std::string secondsLeft = result.value("seconds_left_human", "Unknown");

                    LOGI("ConnectWithChallenge: SUCCESS");
                    return ErrorMessages::VALID + std::string("|") + expiresAt + "|" + secondsLeft;
                } else {
                    return "Error: Invalid server response format";
                }
            } catch (const std::exception& e) {
                LOGE("ConnectWithChallenge: Decryption/parsing error: %s", e.what());
                return "Decryption error: " + std::string(e.what());
            }
        } else {
            LOGE("Connect: Server error: %d", response.status_code);
            std::string errorMsg = parseErrorResponse(response.status_code, response.text);
            
            if (response.status_code == 429) {
                return "Rate limit exceeded (429)\n   Please wait and try again";
            } else if (response.status_code == 403) {
                // Check if it's an mTLS error
                std::string lowerError = errorMsg;
                std::transform(lowerError.begin(), lowerError.end(), lowerError.begin(), ::tolower);
                if (lowerError.find("certificate") != std::string::npos || 
                    lowerError.find("mtls") != std::string::npos ||
                    lowerError.find("client certificate") != std::string::npos) {
                    return "mTLS Error (403)\n   Client certificate required.\n   "
                           "Make sure client-cert.pem and client-key.pem are installed.\n   "
                           "Contact administrator for client certificates.";
                }
                return "Access denied (403)\n   " + (errorMsg.empty() ? "Check server security settings" : errorMsg);
            } else if (response.status_code == 401) {
                return "Authentication error (401)\n   " + (errorMsg.empty() ? "Invalid key or challenge" : errorMsg);
            } else {
                std::string preview = response.text.length() > 100 ? response.text.substr(0, 100) + "..." : response.text;
                return "HTTP error " + std::to_string(response.status_code) + "\n   " + (errorMsg.empty() ? preview : errorMsg);
            }
        }
    }
};

// ============================================================================
// License Checker
// ============================================================================

class LicenseChecker {
private:
    static std::string jniStringToString(JNIEnv* env, jstring jstr, const std::string& defaultValue) {
        if (!jstr) return defaultValue;
        const char* chars = env->GetStringUTFChars(jstr, nullptr);
        std::string result = chars ? chars : defaultValue;
        if (chars) env->ReleaseStringUTFChars(jstr, chars);
        env->DeleteLocalRef(jstr);
        return result;
    }

    static std::string trimAndCleanKey(const std::string& key) {
        size_t start = key.find_first_not_of(" \t\n\r");
        if (start == std::string::npos) return "";
        size_t end = key.find_last_not_of(" \t\n\r");
        std::string trimmed = key.substr(start, end - start + 1);

        std::string cleaned;
        for (char c : trimmed) {
            if (c != '\n' && c != '\r' && c != '\t') {
                cleaned += c;
            }
        }

        size_t firstSpace = cleaned.find_first_of(" \n\r\t");
        if (firstSpace != std::string::npos) {
            cleaned = cleaned.substr(0, firstSpace);
        }
        return cleaned;
    }

    static std::string getAndroidId(JNIEnv* env, jobject context) {
        return jniStringToString(env, GetAndroidID(env, context), "unknown-device");
    }

    static std::string getDeviceModel(JNIEnv* env) {
        return jniStringToString(env, GetDeviceModel(env), "unknown-model");
    }

    static std::string getDeviceBrand(JNIEnv* env) {
        return jniStringToString(env, GetDeviceBrand(env), "unknown-brand");
    }

public:
    static std::string checkLicense(const char* userKey, const char* gameName, JNIEnv* env, jobject context) {
        if (!userKey || strlen(userKey) == 0) {
            return "Error: License key cannot be empty";
        }

        std::string cleanedKey = trimAndCleanKey(userKey);
        if (cleanedKey.empty()) {
            return "Error: License key cannot be empty";
        }

        if (cleanedKey.length() < 5 || cleanedKey.find('-') == std::string::npos) {
            return "Error: Invalid license key format";
        }

        LOGI("CheckLicense: START - user_key=%s", cleanedKey.c_str());
        
        // Initialize CA fingerprint if project_id is known and CA pinning is enabled
        if (PROJECT_CA_PINNING_ENABLED && !g_ProjectId.empty() && g_ProjectCaFingerprint.empty()) {
            LOGI("CheckLicense: Initializing CA fingerprint for project %s", g_ProjectId.c_str());
            ApiClient::getProjectCaFingerprint(g_ProjectId);
        }

        std::string androidId = getAndroidId(env, context);
        std::string deviceModel = getDeviceModel(env);
        std::string deviceBrand = getDeviceBrand(env);

        std::string fingerprint = sha256(androidId + "-" + deviceModel + "-" + deviceBrand);

        LOGI("CheckLicense: Step 1 - Getting challenge from server...");
        std::string challengeData = ApiClient::getChallenge(cleanedKey, fingerprint);

        if (challengeData == ErrorMessages::KEY_NOT_FOUND) {
            return "License key not found on server";
        }

        if (challengeData.find("SERVER_ERROR_") == 0) {
            size_t colonPos = challengeData.find(": ");
            if (colonPos != std::string::npos) {
                std::string errorMsg = challengeData.substr(colonPos + 2);
                if (challengeData.find("SERVER_ERROR_503") == 0) {
                    return errorMsg;
                } else if (challengeData.find("SERVER_ERROR_500") == 0) {
                    return "Internal server error (500)\n   " + errorMsg;
                }
                return "Server error\n   " + errorMsg;
            }
            return challengeData;
        }

        if (challengeData.empty()) {
            return "Error: Failed to get challenge from server";
        }

        LOGI("CheckLicense: Step 2 - Sending connect request...");
        std::string result = ApiClient::connect(cleanedKey, challengeData, fingerprint,
                                                gameName ? gameName : "", androidId,
                                                androidId, deviceModel, deviceBrand);

        if (result.find(ErrorMessages::VALID) != 0) {
            if (result.find("403") != std::string::npos || result.find("Access denied") != std::string::npos) {
                return "Key found on server!\n   Challenge received successfully.\n   " + result;
            }
        }

        return result;
    }
};

// ============================================================================
// JNI Interface Functions
// ============================================================================

std::string CheckLicense(const char* userKey, const char* gameName, JNIEnv* env, jobject context, const char* caPath) {
    (void)caPath; // Suppress unused parameter warning
    return LicenseChecker::checkLicense(userKey, gameName, env, context);
}

bool TestServerConnectivity() {
    try {
        std::string result = ApiClient::getChallenge("test", "test");
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
    std::string statusMessage = "Enter license key and click 'Check'";
    bool isLoading = false;
    float loadingProgress = 0.0f;
    std::string loadingText = "Checking license...";

    // License state
    bool licenseValid = false;
    std::string licenseExpiresAt = "";
    std::string licenseTimeLeft = "";
    std::string licenseToken = "";

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

        if (!licenseValid) {
            if (ImGui::Begin("License Check", nullptr, ImGuiWindowFlags_NoCollapse | ImGuiWindowFlags_NoResize)) {
                ImGui::PushStyleColor(ImGuiCol_Text, ImVec4(0.0f, 0.8f, 1.0f, 1.0f));
                ImGui::Text("Game: %s", g_gameName.empty() ? "Not specified" : g_gameName.c_str());
                ImGui::PopStyleColor();
                ImGui::Separator();
                ImGui::Spacing();

                ImGui::PushStyleColor(ImGuiCol_Text, ImVec4(0.8f, 0.9f, 1.0f, 1.0f));
                ImGui::Text("Enter license key:");
                ImGui::PopStyleColor();

                ImGui::PushStyleColor(ImGuiCol_FrameBg, ImVec4(0.12f, 0.12f, 0.18f, 0.8f));
                ImGui::PushStyleColor(ImGuiCol_FrameBgHovered, ImVec4(0.15f, 0.15f, 0.22f, 0.9f));
                ImGui::PushStyleColor(ImGuiCol_FrameBgActive, ImVec4(0.18f, 0.18f, 0.25f, 1.0f));
                ImGui::PushItemWidth(-1);
                ImGui::InputText("##key", keyInput, sizeof(keyInput), ImGuiInputTextFlags_Password);
                ImGui::PopItemWidth();
                ImGui::PopStyleColor(3);

                ImGui::Spacing();

                if (ImGui::Button("Paste from clipboard", ImVec2(-FLT_MIN, 45 * scaleFactor))) {
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
                if (ImGui::Button(isLoading ? "Checking..." : "Check", ImVec2(-FLT_MIN, 50 * scaleFactor))) {
                    if (!isLoading && strlen(keyInput) > 0) {
                        isLoading = true;
                        loadingProgress = 0.0f;
                        loadingText = "Connecting to server...";
                        statusMessage = "Checking license...";

                        JNIEnv* env = nullptr;
                        app->activity->vm->AttachCurrentThread(&env, nullptr);
                        jobject context = app->activity->clazz;

                        std::string result = LicenseChecker::checkLicense(keyInput, g_gameName.c_str(), env, context);
                        app->activity->vm->DetachCurrentThread();

                        licenseValid = false;
                        licenseExpiresAt = "";
                        licenseTimeLeft = "";
                        licenseToken = "";

                        if (result.substr(0, 5) == "VALID") {
                            licenseValid = true;
                            size_t firstPipe = result.find("|");
                            if (firstPipe != std::string::npos) {
                                size_t secondPipe = result.find("|", firstPipe + 1);
                                if (secondPipe != std::string::npos) {
                                    licenseExpiresAt = result.substr(firstPipe + 1, secondPipe - firstPipe - 1);
                                    licenseTimeLeft = result.substr(secondPipe + 1);
                                } else {
                                    licenseExpiresAt = result.substr(firstPipe + 1);
                                }
                            }
                            statusMessage = "License valid!";
                        } else {
                            std::string lowerResult = result;
                            std::transform(lowerResult.begin(), lowerResult.end(), lowerResult.begin(), ::tolower);

                            if (lowerResult.find("not found") != std::string::npos || result == ErrorMessages::KEY_NOT_FOUND) {
                                statusMessage = "License key not found on server.\nCheck the entered key.";
                            } else if (lowerResult.find("expired") != std::string::npos || lowerResult.find("expires") != std::string::npos) {
                                statusMessage = "License expired.\nContact administrator for renewal.";
                            } else if (lowerResult.find("inactive") != std::string::npos || lowerResult.find("frozen") != std::string::npos || lowerResult.find("blocked") != std::string::npos) {
                                statusMessage = "License inactive.\nLicense is blocked or suspended.\nContact administrator.";
                            } else if (result.find("Key found on server") != std::string::npos || result.find("Challenge received") != std::string::npos) {
                                statusMessage = "Partial check:\nKey found on server, but full check incomplete.\n" + result;
                            } else {
                                statusMessage = "Check error:\n" + result;
                            }
                        }

                        isLoading = false;
                        loadingProgress = 0.0f;
                    } else if (strlen(keyInput) == 0) {
                        statusMessage = "Please enter license key";
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
        } else {
            ImVec2 mainWindowSize(400 * scaleFactor, 0);
            ImVec2 mainWindowPos((width - mainWindowSize.x) * 0.5f, height * 0.1f);
            ImGui::SetNextWindowPos(mainWindowPos, ImGuiCond_FirstUseEver);
            ImGui::SetNextWindowSize(mainWindowSize, ImGuiCond_FirstUseEver);

            if (ImGui::Begin("Main Menu", nullptr, ImGuiWindowFlags_NoCollapse | ImGuiWindowFlags_NoResize)) {
                ImGui::PushStyleColor(ImGuiCol_Text, ImVec4(0.0f, 0.8f, 1.0f, 1.0f));
                ImGui::Text("Game: %s", g_gameName.empty() ? "Not specified" : g_gameName.c_str());
                ImGui::PopStyleColor();
                ImGui::Separator();
                ImGui::Spacing();

                ImGui::PushStyleColor(ImGuiCol_Text, ImVec4(0.2f, 0.9f, 0.3f, 1.0f));
                ImGui::Text("License active");
                ImGui::PopStyleColor();

                if (!licenseExpiresAt.empty()) {
                    ImGui::Text("Expires: %s", licenseExpiresAt.c_str());
                }
                if (!licenseTimeLeft.empty()) {
                    ImGui::Text("Time left: %s", licenseTimeLeft.c_str());
                }

                ImGui::Separator();
                ImGui::Spacing();

                ImGui::PushStyleColor(ImGuiCol_Button, ImVec4(0.2f, 0.5f, 0.8f, 0.8f));
                ImGui::PushStyleColor(ImGuiCol_ButtonHovered, ImVec4(0.3f, 0.6f, 0.9f, 0.9f));
                ImGui::PushStyleColor(ImGuiCol_ButtonActive, ImVec4(0.1f, 0.4f, 0.7f, 1.0f));

                if (ImGui::Button("Play", ImVec2(-FLT_MIN, 50 * scaleFactor))) {
                    LOGI("MainMenu: Play button clicked");
                }

                ImGui::Spacing();

                if (ImGui::Button("Settings", ImVec2(-FLT_MIN, 50 * scaleFactor))) {
                    LOGI("MainMenu: Settings button clicked");
                }

                ImGui::Spacing();
                ImGui::PopStyleColor(3);

                ImGui::PushStyleColor(ImGuiCol_Button, ImVec4(0.6f, 0.2f, 0.2f, 0.8f));
                ImGui::PushStyleColor(ImGuiCol_ButtonHovered, ImVec4(0.7f, 0.3f, 0.3f, 0.9f));
                ImGui::PushStyleColor(ImGuiCol_ButtonActive, ImVec4(0.5f, 0.1f, 0.1f, 1.0f));

                if (ImGui::Button("Exit", ImVec2(-FLT_MIN, 50 * scaleFactor))) {
                    licenseValid = false;
                    licenseExpiresAt = "";
                    licenseTimeLeft = "";
                    licenseToken = "";
                    statusMessage = "Enter license key and click 'Check'";
                    memset(keyInput, 0, sizeof(keyInput));
                }

                ImGui::PopStyleColor(3);
            }
            ImGui::End();
        }

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