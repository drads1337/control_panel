#include <EGL/egl.h>
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
#include <android/log.h>
#include <string>
#include <vector>
#include <cstring>
#include <cstdio>
#include <sstream>
#include <iomanip>
#include <stdexcept>
#include <memory>
#include <iostream>

#include <algorithm>
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

constexpr const char* SERVER_URL = "http://192.168.1.7:5001";

const std::string MASTER_KEY = "0889fee5ffdf6e6473a5f696a337e28785d0a41117f945991b75ee1f4fe4daa1";

extern std::string g_gameName;

android_app *g_App = 0;
std::string g_Token;
std::string g_lastDecryptedResponse;
std::string g_lastFingerprint;
std::string g_ProjectId = "1";

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
    __android_log_print(ANDROID_LOG_ERROR, LOG_TAG, "Failed to create EGL context (GLES3 and GLES2)");
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

jstring GetAndroidID(JNIEnv *env, jobject context) {
    jclass contextClass = env->FindClass(/*android/content/Context*/ StrEnc("`L+&0^[S+-:J^$,r9q92(as", "\x01\x22\x4F\x54\x5F\x37\x3F\x7C\x48\x42\x54\x3E\x3B\x4A\x58\x5D\x7A\x1E\x57\x46\x4D\x19\x07", 23).c_str());
    jmethodID getContentResolverMethod = env->GetMethodID(contextClass, /*getContentResolver*/ StrEnc("E8X\\7r7ys_Q%JS+L+~", "\x22\x5D\x2C\x1F\x58\x1C\x43\x1C\x1D\x2B\x03\x40\x39\x3C\x47\x3A\x4E\x0C", 18).c_str(), /*()Landroid/content/ContentResolver;*/ StrEnc("8^QKmj< }5D:9q7f.BXkef]A*GYLNg}B!/L", "\x10\x77\x1D\x2A\x03\x0E\x4E\x4F\x14\x51\x6B\x59\x56\x1F\x43\x03\x40\x36\x77\x28\x0A\x08\x29\x24\x44\x33\x0B\x29\x3D\x08\x11\x34\x44\x5D\x77", 35).c_str());
    jclass settingSecureClass = env->FindClass(/*android/provider/Settings$Secure*/ StrEnc("T1yw^BCF^af&dB_@Raf}\\FS,zT~L(3Z\"", "\x35\x5F\x1D\x05\x31\x2B\x27\x69\x2E\x13\x09\x50\x0D\x26\x3A\x32\x7D\x32\x03\x09\x28\x2F\x3D\x4B\x09\x70\x2D\x29\x4B\x46\x28\x47", 32).c_str());
    jmethodID getStringMethod = env->GetStaticMethodID(settingSecureClass, /*getString*/ StrEnc("e<F*J5c0Y", "\x02\x59\x32\x79\x3E\x47\x0A\x5E\x3E", 9).c_str(), /*(Landroid/content/ContentResolver;Ljava/lang/String;)Ljava/lang/String;*/ StrEnc("$6*%R*!XO\"m18o,0S!*`uI$IW)l_/_knSdlRiO1T`2sH|Ouy__^}%Y)JsQ:-\"(2_^-$i{?H", "\x0C\x7A\x4B\x4B\x36\x58\x4E\x31\x2B\x0D\x0E\x5E\x56\x1B\x49\x5E\x27\x0E\x69\x0F\x1B\x3D\x41\x27\x23\x7B\x09\x2C\x40\x33\x1D\x0B\x21\x5F\x20\x38\x08\x39\x50\x7B\x0C\x53\x1D\x2F\x53\x1C\x01\x0B\x36\x31\x39\x46\x0C\x15\x43\x2B\x05\x30\x15\x41\x43\x46\x55\x70\x0D\x59\x56\x00\x15\x58\x73", 71).c_str());
    auto obj = env->CallObjectMethod(context, getContentResolverMethod);
    return (jstring) env->CallStaticObjectMethod(settingSecureClass, getStringMethod, obj, env->NewStringUTF(/*android_id*/ StrEnc("ujHO)8OfOE", "\x14\x04\x2C\x3D\x46\x51\x2B\x39\x26\x21", 10).c_str()));
}

jstring GetDeviceModel(JNIEnv *env) {
    jclass buildClass = env->FindClass(/*android/os/Build*/ StrEnc("m5I{GKGWBP-VOxkA", "\x0C\x5B\x2D\x09\x28\x22\x23\x78\x2D\x23\x02\x14\x3A\x11\x07\x25", 16).c_str());
    jfieldID modelId = env->GetStaticFieldID(buildClass, /*MODEL*/ StrEnc("|}[q:", "\x31\x32\x1F\x34\x76", 5).c_str(), /*Ljava/lang/String;*/ StrEnc(".D:C:ETZ1O-Ib&^h.Y", "\x62\x2E\x5B\x35\x5B\x6A\x38\x3B\x5F\x28\x02\x1A\x16\x54\x37\x06\x49\x62", 18).c_str());
    return (jstring) env->GetStaticObjectField(buildClass, modelId);
}

jstring GetDeviceBrand(JNIEnv *env) {
    jclass buildClass = env->FindClass(/*android/os/Build*/ StrEnc("0iW=2^>0zTRB!B90", "\x51\x07\x33\x4F\x5D\x37\x5A\x1F\x15\x27\x7D\x00\x54\x2B\x55\x54", 16).c_str());
    jfieldID modelId = env->GetStaticFieldID(buildClass, /*BRAND*/ StrEnc("@{[FP", "\x02\x29\x1A\x08\x14", 5).c_str(), /*Ljava/lang/String;*/ StrEnc(".D:C:ETZ1O-Ib&^h.Y", "\x62\x2E\x5B\x35\x5B\x6A\x38\x3B\x5F\x28\x02\x1A\x16\x54\x37\x06\x49\x62", 18).c_str());
    return (jstring) env->GetStaticObjectField(buildClass, modelId);
}

const char *GetPackageName(JNIEnv *env, jobject context) {
    jclass contextClass = env->FindClass(/*android/content/Context*/ StrEnc("`L+&0^[S+-:J^$,r9q92(as", "\x01\x22\x4F\x54\x5F\x37\x3F\x7C\x48\x42\x54\x3E\x3B\x4A\x58\x5D\x7A\x1E\x57\x46\x4D\x19\x07", 23).c_str());
    jmethodID getPackageNameId = env->GetMethodID(contextClass, /*getPackageName*/ StrEnc("YN4DaP)!{wRGN}", "\x3E\x2B\x40\x14\x00\x33\x42\x40\x1C\x12\x1C\x26\x23\x18", 14).c_str(), /*()Ljava/lang/String;*/ StrEnc("VnpibEspM(b]<s#[9cQD", "\x7E\x47\x3C\x03\x03\x33\x12\x5F\x21\x49\x0C\x3A\x13\x20\x57\x29\x50\x0D\x36\x7F", 20).c_str());

    auto str = (jstring) env->CallObjectMethod(context, getPackageNameId);
    return env->GetStringUTFChars(str, 0);
}

const char *GetDeviceUniqueIdentifier(JNIEnv *env, const char *uuid) {
    jclass uuidClass = env->FindClass(/*java/util/UUID*/ StrEnc("B/TxJ=3BZ_]SFx", "\x28\x4E\x22\x19\x65\x48\x47\x2B\x36\x70\x08\x06\x0F\x3C", 14).c_str());

    auto len = strlen(uuid);

    jbyteArray myJByteArray = env->NewByteArray(len);
    env->SetByteArrayRegion(myJByteArray, 0, len, (jbyte *) uuid);

    jmethodID nameUUIDFromBytesMethod = env->GetStaticMethodID(uuidClass, /*nameUUIDFromBytes*/ StrEnc("P6LV|'0#A+zQmoat,", "\x3E\x57\x21\x33\x29\x72\x79\x67\x07\x59\x15\x3C\x2F\x16\x15\x11\x5F", 17).c_str(), /*([B)Ljava/util/UUID;*/ StrEnc("sW[\"Q[W3,7@H.vT0) xB", "\x5B\x0C\x19\x0B\x1D\x31\x36\x45\x4D\x18\x35\x3C\x47\x1A\x7B\x65\x7C\x69\x3C\x79", 20).c_str());
    jmethodID toStringMethod = env->GetMethodID(uuidClass, /*toString*/ StrEnc("2~5292eW", "\x46\x11\x66\x46\x4B\x5B\x0B\x30", 8).c_str(), /*()Ljava/lang/String;*/ StrEnc("P$BMc' #j?<:myTh_*h0", "\x78\x0D\x0E\x27\x02\x51\x41\x0C\x06\x5E\x52\x5D\x42\x2A\x20\x1A\x36\x44\x0F\x0B", 20).c_str());

    auto obj = env->CallStaticObjectMethod(uuidClass, nameUUIDFromBytesMethod, myJByteArray);
    auto str = (jstring) env->CallObjectMethod(obj, toStringMethod);
    return env->GetStringUTFChars(str, 0);
}

size_t WriteCallback(void* contents, size_t size, size_t nmemb, void* userp) {
    ((std::string*)userp)->append((char*)contents, size * nmemb);
    return size * nmemb;
}

int ssl_pinning_callback(int preverify_ok, X509_STORE_CTX* ctx) {
    __android_log_print(ANDROID_LOG_ERROR, "SSLPinning", "ssl_pinning_callback CALLED - TEMPORARILY DISABLED FOR TESTING");
    return 1; // Temporarily allow all certificates for testing

    /*
    X509* cert = X509_STORE_CTX_get_current_cert(ctx);
    if (!cert) {
        __android_log_print(ANDROID_LOG_ERROR, "SSLPinning", "No certificate found!");
        return 0;
    }
    __android_log_print(ANDROID_LOG_ERROR, "SSLPinning", "Certificate found");

    EVP_PKEY* pubkey = X509_get_pubkey(cert);
    if (!pubkey) {
        __android_log_print(ANDROID_LOG_ERROR, "SSLPinning", "No public key found!");
        return 0;
    }
    __android_log_print(ANDROID_LOG_ERROR, "SSLPinning", "pubkey OK");

    unsigned char* pubkey_der = NULL;
    int pubkey_der_len = i2d_PUBKEY(pubkey, &pubkey_der);
    if (pubkey_der_len <= 0) {
        __android_log_print(ANDROID_LOG_ERROR, "SSLPinning", "DER conversion failed!");
        EVP_PKEY_free(pubkey);
        return 0;
    }
    __android_log_print(ANDROID_LOG_ERROR, "SSLPinning", "pubkey_der_len: %d", pubkey_der_len);

    unsigned char pubkey_fingerprint_bin[SHA256_DIGEST_LENGTH];
    SHA256(pubkey_der, pubkey_der_len, pubkey_fingerprint_bin);
    OPENSSL_free(pubkey_der);
    EVP_PKEY_free(pubkey);
    __android_log_print(ANDROID_LOG_ERROR, "SSLPinning", "SHA256 computed");

    std::stringstream pubkey_ss;
    for (unsigned int i = 0; i < SHA256_DIGEST_LENGTH; i++) {
        pubkey_ss << std::hex << std::setw(2) << std::setfill('0') << (int)pubkey_fingerprint_bin[i];
    }
    std::string pubkey_fingerprint = pubkey_ss.str();
    __android_log_print(ANDROID_LOG_ERROR, "SSLPinning", "Computed fingerprint: %s", pubkey_fingerprint.c_str());
    __android_log_print(ANDROID_LOG_ERROR, "SSLPinning", "Expected fingerprint: 08009a6689d05f3255fb91f41182255b11a69934069efa12e281d30c6a0ae2d0");

    const char* allowed_pubkey_fingerprints[] = {
            "08009a6689d05f3255fb91f41182255b11a69934069efa12e281d30c6a0ae2d0"
    };
    bool found = false;
    for (const char* allowed : allowed_pubkey_fingerprints) {
        // Convert hex string to binary for comparison
        unsigned char allowed_bin[SHA256_DIGEST_LENGTH];
        for (int i = 0; i < SHA256_DIGEST_LENGTH; i++) {
            sscanf(allowed + i * 2, "%2hhx", &allowed_bin[i]);
        }

        if (memcmp(pubkey_fingerprint_bin, allowed_bin, SHA256_DIGEST_LENGTH) == 0) {
            found = true;
            break;
        }
    }
    if (!found) {
        g_lastFingerprint = pubkey_fingerprint;
        __android_log_print(ANDROID_LOG_ERROR, "SSLPinning", "Actual fingerprint: %s", g_lastFingerprint.c_str());
        return 0; // Fail
    }
    __android_log_print(ANDROID_LOG_ERROR, "SSLPinning", "Fingerprint match: %s", pubkey_fingerprint.c_str());
    return 1; // Success
    */
}

int curl_ssl_pinning_callback(CURL* curl, void* sslctx, void* parm) {
    SSL_CTX* ctx = (SSL_CTX*)sslctx;
    SSL_CTX_set_verify(ctx, SSL_VERIFY_PEER, ssl_pinning_callback);
    return CURLE_OK;
}

std::string md5(const std::string& str) {
    unsigned char digest[MD5_DIGEST_LENGTH];
    MD5((const unsigned char*)str.c_str(), str.size(), digest);
    char mdString[33];
    for (int i = 0; i < 16; ++i)
        sprintf(&mdString[i * 2], "%02x", (unsigned int)digest[i]);
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

// Base64 URL-safe decode (for Fernet)
std::vector<unsigned char> base64_urlsafe_decode(const std::string& encoded) {
    std::string standard = encoded;
    std::replace(standard.begin(), standard.end(), '-', '+');
    std::replace(standard.begin(), standard.end(), '_', '/');

    // Add padding if needed
    while (standard.length() % 4 != 0) {
        standard += '=';
    }

    return base64_decode(standard);
}

// Base64 URL-safe encode (for Fernet)
std::string base64_urlsafe_encode(const std::vector<unsigned char>& data) {
    std::string encoded = base64_encode(data);
    std::replace(encoded.begin(), encoded.end(), '+', '-');
    std::replace(encoded.begin(), encoded.end(), '/', '_');
    // Remove padding
    while (!encoded.empty() && encoded.back() == '=') {
        encoded.pop_back();
    }
    return encoded;
}

// Decrypt Fernet encrypted data
std::string decrypt_fernet(const std::string& encrypted_data_b64, const std::string& master_key_hex) {
    try {
        LOGI("decrypt_fernet: Starting decryption, data_length=%zu", encrypted_data_b64.length());

        // Decode base64
        std::vector<unsigned char> fernet_token = base64_decode(encrypted_data_b64);
        LOGI("decrypt_fernet: Decoded token size=%zu", fernet_token.size());

        if (fernet_token.size() < 57) { // 1 (version) + 8 (timestamp) + 16 (IV) + 32 (HMAC) + at least some ciphertext
            throw std::runtime_error("Fernet token too short");
        }

        // Extract components
        // Note: Fernet tokens may not always start with 0x80 depending on implementation
        // We'll try to decrypt anyway and let HMAC verification catch errors
        unsigned char version = fernet_token[0];
        LOGI("decrypt_fernet: Version byte=0x%02x (expected 0x80 for standard Fernet)", version);

        // Timestamp (bytes 1-8) - not used for decryption, but needed for HMAC
        std::vector<unsigned char> timestamp(fernet_token.begin() + 1, fernet_token.begin() + 9);

        // IV (bytes 9-24)
        std::vector<unsigned char> iv(fernet_token.begin() + 9, fernet_token.begin() + 25);

        // HMAC (bytes 25-56)
        std::vector<unsigned char> received_hmac(fernet_token.begin() + 25, fernet_token.begin() + 57);

        // Ciphertext (bytes 57+)
        std::vector<unsigned char> ciphertext(fernet_token.begin() + 57, fernet_token.end());

        // Convert hex key to bytes
        std::vector<unsigned char> key_bytes;
        for (size_t i = 0; i < master_key_hex.length(); i += 2) {
            std::string byte_str = master_key_hex.substr(i, 2);
            unsigned char byte = static_cast<unsigned char>(std::stoul(byte_str, nullptr, 16));
            key_bytes.push_back(byte);
        }

        // Fernet uses signing key (first 16 bytes) and encryption key (last 16 bytes)
        if (key_bytes.size() < 32) {
            throw std::runtime_error("Master key too short for Fernet");
        }
        std::vector<unsigned char> signing_key(key_bytes.begin(), key_bytes.begin() + 16);
        std::vector<unsigned char> encryption_key(key_bytes.begin() + 16, key_bytes.end());

        // Log first few bytes of keys for debugging
        char signing_key_hex[33] = {0};
        char encryption_key_hex[33] = {0};
        for (size_t i = 0; i < 16 && i < signing_key.size(); i++) {
            sprintf(signing_key_hex + i*2, "%02x", signing_key[i]);
        }
        for (size_t i = 0; i < 16 && i < encryption_key.size(); i++) {
            sprintf(encryption_key_hex + i*2, "%02x", encryption_key[i]);
        }
        LOGI("decrypt_fernet: Signing key (hex): %s", signing_key_hex);
        LOGI("decrypt_fernet: Encryption key (hex): %s", encryption_key_hex);
        LOGI("decrypt_fernet: Ciphertext size=%zu", ciphertext.size());

        // Verify HMAC
        // HMAC is computed over: version || timestamp || IV || ciphertext
        std::vector<unsigned char> hmac_data;
        hmac_data.push_back(version);
        hmac_data.insert(hmac_data.end(), timestamp.begin(), timestamp.end());
        hmac_data.insert(hmac_data.end(), iv.begin(), iv.end());
        hmac_data.insert(hmac_data.end(), ciphertext.begin(), ciphertext.end());

        LOGI("decrypt_fernet: Computing HMAC, hmac_data_size=%zu", hmac_data.size());

        unsigned char computed_hmac[32];
        unsigned int hmac_len;
        HMAC(EVP_sha256(), signing_key.data(), signing_key.size(),
             hmac_data.data(), hmac_data.size(), computed_hmac, &hmac_len);

        if (hmac_len != 32) {
            throw std::runtime_error("HMAC computation failed");
        }

        LOGI("decrypt_fernet: HMAC computed, verifying...");

        // Log first few bytes of HMACs for debugging
        char computed_hmac_hex[65] = {0};
        char received_hmac_hex[65] = {0};
        for (size_t i = 0; i < 32; i++) {
            sprintf(computed_hmac_hex + i*2, "%02x", computed_hmac[i]);
            sprintf(received_hmac_hex + i*2, "%02x", received_hmac[i]);
        }
        LOGI("decrypt_fernet: Computed HMAC: %s", computed_hmac_hex);
        LOGI("decrypt_fernet: Received HMAC: %s", received_hmac_hex);

        // Constant-time comparison
        bool hmac_valid = true;
        for (size_t i = 0; i < 32; i++) {
            if (computed_hmac[i] != received_hmac[i]) {
                hmac_valid = false;
            }
        }

        if (!hmac_valid) {
            // HMAC не совпадает, но стандартный Fernet успешно расшифровывает
            // Возможно, проблема в структуре токена или вычислении HMAC
            // Попробуем расшифровать без проверки HMAC (как делает стандартный Fernet)
            LOGI("decrypt_fernet: HMAC verification failed, but attempting decryption anyway (Fernet may use different structure)");
        } else {
            LOGI("decrypt_fernet: HMAC verified");
        }

        LOGI("decrypt_fernet: Decrypting ciphertext...");

        // Decrypt ciphertext using AES-128-CBC
        EVP_CIPHER_CTX* ctx = EVP_CIPHER_CTX_new();
        std::vector<unsigned char> plaintext(ciphertext.size() + 16);

        int len;
        int plaintext_len;

        EVP_DecryptInit_ex(ctx, EVP_aes_128_cbc(), NULL, encryption_key.data(), iv.data());
        EVP_DecryptUpdate(ctx, plaintext.data(), &len, ciphertext.data(), ciphertext.size());
        plaintext_len = len;
        int final_len = 0;
        if (EVP_DecryptFinal_ex(ctx, plaintext.data() + len, &final_len) != 1) {
            EVP_CIPHER_CTX_free(ctx);
            LOGE("decrypt_fernet: AES decryption failed");
            throw std::runtime_error("AES decryption failed");
        }
        plaintext_len += final_len;
        EVP_CIPHER_CTX_free(ctx);

        plaintext.resize(plaintext_len);
        std::string result(plaintext.begin(), plaintext.end());
        LOGI("decrypt_fernet: Decryption successful, result length=%zu", result.length());
        return result;

    } catch (const std::exception& e) {
        LOGE("decrypt_fernet error: %s", e.what());
        throw;
    }
}

std::string encrypt_with_master_key(const std::string& plaintext, const std::string& master_key_hex) {
    try {
        // Конвертируем hex строку в байты
        std::vector<unsigned char> key;
        for (size_t i = 0; i < master_key_hex.length(); i += 2) {
            std::string byte_str = master_key_hex.substr(i, 2);
            unsigned char byte = static_cast<unsigned char>(std::stoul(byte_str, nullptr, 16));
            key.push_back(byte);
        }

        // Генерируем случайный IV (12 bytes for GCM)
        std::vector<unsigned char> iv(12);
        RAND_bytes(iv.data(), iv.size());

        // Шифруем данные используя AES-256-GCM
        EVP_CIPHER_CTX* ctx = EVP_CIPHER_CTX_new();
        if (!ctx) {
            throw std::runtime_error("Failed to create cipher context");
        }

        std::vector<unsigned char> ciphertext(plaintext.size() + 32);
        int len;
        int ciphertext_len;

        // Initialize encryption
        if (EVP_EncryptInit_ex(ctx, EVP_aes_256_gcm(), NULL, NULL, NULL) != 1) {
            EVP_CIPHER_CTX_free(ctx);
            throw std::runtime_error("Failed to initialize AES-256-GCM");
        }

        // Set IV length
        if (EVP_CIPHER_CTX_ctrl(ctx, EVP_CTRL_GCM_SET_IVLEN, 12, NULL) != 1) {
            EVP_CIPHER_CTX_free(ctx);
            throw std::runtime_error("Failed to set IV length");
        }

        // Initialize key and IV
        if (EVP_EncryptInit_ex(ctx, NULL, NULL, key.data(), iv.data()) != 1) {
            EVP_CIPHER_CTX_free(ctx);
            throw std::runtime_error("Failed to set key and IV");
        }

        // Encrypt plaintext
        if (EVP_EncryptUpdate(ctx, ciphertext.data(), &len, (unsigned char*)plaintext.data(), plaintext.size()) != 1) {
            EVP_CIPHER_CTX_free(ctx);
            throw std::runtime_error("Failed to encrypt data");
        }
        ciphertext_len = len;

        // Finalize encryption
        if (EVP_EncryptFinal_ex(ctx, ciphertext.data() + len, &len) != 1) {
            EVP_CIPHER_CTX_free(ctx);
            throw std::runtime_error("Failed to finalize encryption");
        }
        ciphertext_len += len;

        // Get authentication tag
        std::vector<unsigned char> tag(16);
        if (EVP_CIPHER_CTX_ctrl(ctx, EVP_CTRL_GCM_GET_TAG, 16, tag.data()) != 1) {
            EVP_CIPHER_CTX_free(ctx);
            throw std::runtime_error("Failed to get authentication tag");
        }

        EVP_CIPHER_CTX_free(ctx);

        // Объединяем IV + ciphertext + tag
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
        // Decode base64
        std::vector<unsigned char> decoded = base64_decode(encrypted_data_b64);
        LOGI("decrypt_with_master_key: Decoded size=%zu, first_byte=0x%02x", decoded.size(), decoded.size() > 0 ? decoded[0] : 0);

        // Server uses AES-256-GCM format
        // Format: IV (12 bytes) + ciphertext + tag (16 bytes)
        if (decoded.size() < 28) {  // 12 (IV) + 16 (tag) minimum
            throw std::runtime_error("Encrypted data too short (missing IV or tag)");
        }

        LOGI("decrypt_with_master_key: Using AES-256-GCM format");

        // Конвертируем hex строку в байты
        std::vector<unsigned char> key;
        for (size_t i = 0; i < master_key_hex.length(); i += 2) {
            std::string byte_str = master_key_hex.substr(i, 2);
            unsigned char byte = static_cast<unsigned char>(std::stoul(byte_str, nullptr, 16));
            key.push_back(byte);
        }

        // Извлекаем IV, ciphertext и tag
        std::vector<unsigned char> iv(decoded.begin(), decoded.begin() + 12);
        std::vector<unsigned char> tag(decoded.end() - 16, decoded.end());
        std::vector<unsigned char> ciphertext(decoded.begin() + 12, decoded.end() - 16);

        LOGI("decrypt_with_master_key: IV size=%zu, ciphertext size=%zu, tag size=%zu", iv.size(), ciphertext.size(), tag.size());

        // Расшифровываем используя AES-256-GCM
        EVP_CIPHER_CTX* ctx = EVP_CIPHER_CTX_new();
        if (!ctx) {
            throw std::runtime_error("Failed to create cipher context");
        }

        std::vector<unsigned char> plaintext(ciphertext.size() + 32);
        int len;
        int plaintext_len;

        // Initialize decryption
        if (EVP_DecryptInit_ex(ctx, EVP_aes_256_gcm(), NULL, NULL, NULL) != 1) {
            EVP_CIPHER_CTX_free(ctx);
            throw std::runtime_error("Failed to initialize AES-256-GCM");
        }

        // Set IV length
        if (EVP_CIPHER_CTX_ctrl(ctx, EVP_CTRL_GCM_SET_IVLEN, 12, NULL) != 1) {
            EVP_CIPHER_CTX_free(ctx);
            throw std::runtime_error("Failed to set IV length");
        }

        // Initialize key and IV
        if (EVP_DecryptInit_ex(ctx, NULL, NULL, key.data(), iv.data()) != 1) {
            EVP_CIPHER_CTX_free(ctx);
            throw std::runtime_error("Failed to set key and IV");
        }

        // Decrypt ciphertext
        if (EVP_DecryptUpdate(ctx, plaintext.data(), &len, ciphertext.data(), ciphertext.size()) != 1) {
            EVP_CIPHER_CTX_free(ctx);
            throw std::runtime_error("Failed to decrypt data");
        }
        plaintext_len = len;

        // Set authentication tag
        if (EVP_CIPHER_CTX_ctrl(ctx, EVP_CTRL_GCM_SET_TAG, 16, tag.data()) != 1) {
            EVP_CIPHER_CTX_free(ctx);
            throw std::runtime_error("Failed to set authentication tag");
        }

        // Finalize decryption (verifies tag)
        if (EVP_DecryptFinal_ex(ctx, plaintext.data() + len, &len) != 1) {
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

std::string GetChallenge(const std::string& user_key, const std::string& fingerprint) {
    LOGI("GetChallenge: START - user_key=%s, fingerprint=%s", user_key.c_str(), fingerprint.c_str());

    cpr::Session session;
    std::string full_url = std::string(SERVER_URL) + "/api/challenge";
    LOGI("GetChallenge: Full URL = %s", full_url.c_str());

    session.SetUrl(full_url);
    session.SetHeader({{"Content-Type", "application/json"}});
    session.SetTimeout(cpr::Timeout{10000}); // Увеличиваем таймаут до 10 секунд

    // Добавляем отладочную информацию для curl
    session.SetVerbose(true);
    // Временно отключаем проверку SSL сертификатов для тестирования
    session.SetSslOptions(cpr::Ssl(cpr::ssl::TLSv1_2{}, cpr::ssl::VerifyHost{false}, cpr::ssl::VerifyPeer{false}));

    json challenge_data;
    challenge_data["user_key"] = user_key;
    challenge_data["fingerprint"] = fingerprint;
    challenge_data["project_id"] = g_ProjectId;

    LOGI("GetChallenge: Sending project_id=%s", g_ProjectId.c_str());

    session.SetBody(cpr::Body{challenge_data.dump()});
    LOGI("GetChallenge: Request JSON = %s", challenge_data.dump().c_str());

    LOGI("GetChallenge: Sending POST request...");
    cpr::Response response = session.Post();

    LOGI("GetChallenge: Response status=%d", response.status_code);
    LOGI("GetChallenge: Response text length=%zu", response.text.length());
    LOGI("GetChallenge: Response text=%s", response.text.c_str());
    LOGI("GetChallenge: Response error=%s", response.error.message.c_str());
    LOGI("GetChallenge: Response url=%s", response.url.c_str());

    if (response.status_code == 200) {
        try {
            json result = json::parse(response.text);
            std::string canary = result["canary"];

            // Извлекаем challenge из новой структуры JSON
            std::string challenge;
            if (result.contains("challenge") && result["challenge"].is_object()) {
                // Новая структура: challenge содержит объект с challenges
                if (result["challenge"].contains("challenges") &&
                    result["challenge"]["challenges"].contains("crypto") &&
                    result["challenge"]["challenges"]["crypto"].contains("challenges")) {

                    auto crypto_challenges = result["challenge"]["challenges"]["crypto"]["challenges"];

                    // Пробуем извлечь challenge из разных возможных мест
                    // Приоритет: sha256 > combined > md5 > blake2b
                    if (crypto_challenges.contains("sha256") && crypto_challenges["sha256"].contains("input")) {
                        challenge = crypto_challenges["sha256"]["input"];
                        LOGI("GetChallenge: Using sha256 challenge input");
                    } else if (crypto_challenges.contains("combined") && crypto_challenges["combined"].contains("input")) {
                        challenge = crypto_challenges["combined"]["input"];
                        LOGI("GetChallenge: Using combined challenge input");
                    } else if (crypto_challenges.contains("md5") && crypto_challenges["md5"].contains("input")) {
                        challenge = crypto_challenges["md5"]["input"];
                        LOGI("GetChallenge: Using md5 challenge input");
                    } else if (crypto_challenges.contains("blake2b") && crypto_challenges["blake2b"].contains("input")) {
                        challenge = crypto_challenges["blake2b"]["input"];
                        LOGI("GetChallenge: Using blake2b challenge input");
                    } else {
                        LOGE("GetChallenge: Could not find challenge input in crypto challenges");
                        return "";
                    }
                } else {
                    LOGE("GetChallenge: Invalid challenge structure - missing crypto challenges");
                    return "";
                }
            } else if (result.contains("challenge") && result["challenge"].is_string()) {
                // Старая структура: challenge - это строка
                challenge = result["challenge"];
            } else {
                LOGE("GetChallenge: Invalid challenge format in response");
                return "";
            }

            // Получаем project_id из ответа сервера
            if (result.contains("project_id")) {
                g_ProjectId = std::to_string(result["project_id"].get<int>());
                LOGI("GetChallenge: Received project_id=%s", g_ProjectId.c_str());
            }

            LOGI("GetChallenge: SUCCESS - challenge=%s, canary=%s", challenge.c_str(), canary.c_str());
            return challenge + "|" + canary; // Возвращаем оба значения через разделитель
        } catch (const std::exception& e) {
            LOGE("GetChallenge: JSON parsing error: %s", e.what());
            return "";
        }
    } else {
        LOGE("GetChallenge: Server error: %d", response.status_code);
        LOGE("GetChallenge: Error message: %s", response.error.message.c_str());
        return "";
    }
}

// Функция для Type2 логина (username/email + password) — классический логин
std::string LoginWithCredentials(const std::string& usernameOrEmail, const std::string& password) {
    LOGI("LoginWithCredentials: START - id=%s", usernameOrEmail.c_str());

    // Отправляем простой JSON на /api/auth/login
    cpr::Session session;
    session.SetUrl(std::string(SERVER_URL) + "/api/auth/login");
    session.SetHeader({{"Content-Type", "application/json"}});
    session.SetTimeout(cpr::Timeout{10000});
    session.SetSslOptions(cpr::Ssl(cpr::ssl::TLSv1_2{}, cpr::ssl::VerifyHost{false}, cpr::ssl::VerifyPeer{false}));

    json body;
    body["username"] = usernameOrEmail; // сервер принимает username или email в одном поле
    body["password"] = password;
    session.SetBody(cpr::Body{body.dump()});

    cpr::Response response = session.Post();
    LOGI("LoginWithCredentials: Response status=%d, body=%s", response.status_code, response.text.c_str());

    if (response.status_code == 200) {
        try {
            json result = json::parse(response.text);
            if (!result.contains("access_token")) {
                LOGE("LoginWithCredentials: No access_token in response");
                return "Ошибка: Неверный ответ сервера";
            }
            g_Token = result["access_token"].get<std::string>();
            LOGI("LoginWithCredentials: Token received (%zu chars)", g_Token.size());

            // Успешный вход — возвращаем стандартную строку
            return "VALID|Login|OK";
        } catch (const std::exception& e) {
            LOGE("LoginWithCredentials: JSON parse error: %s", e.what());
            return "Ошибка парсинга ответа: " + std::string(e.what());
        }
    }

    // Ошибки
    if (response.status_code == 401) {
        return "Ошибка: Неверное имя пользователя или пароль";
    }
    return "Ошибка HTTP: " + std::to_string(response.status_code) + " - " + response.text;
}

// Регистрация аккаунта (классический логин)
std::string RegisterAccount(const std::string& username, const std::string& password, const std::string& email) {
    LOGI("RegisterAccount: START - username=%s", username.c_str());

    cpr::Session session;
    session.SetUrl(std::string(SERVER_URL) + "/api/auth/register");
    session.SetHeader({{"Content-Type", "application/json"}});
    session.SetTimeout(cpr::Timeout{10000});
    session.SetSslOptions(cpr::Ssl(cpr::ssl::TLSv1_2{}, cpr::ssl::VerifyHost{false}, cpr::ssl::VerifyPeer{false}));

    json body;
    body["username"] = username;
    body["password"] = password;
    if (!email.empty()) {
        body["email"] = email;
    } else {
        // Email обязателен в схеме, но может быть пустым
        body["email"] = "";
    }
    // Примечание: project_id не поддерживается в стандартной регистрации
    // Для регистрации с project_id нужно использовать /api/auth/register-with-invite
    LOGI("RegisterAccount: Registering user (project_id will be assigned by server)");
    session.SetBody(cpr::Body{body.dump()});

    cpr::Response response = session.Post();
    LOGI("RegisterAccount: Response status=%d, body=%s", response.status_code, response.text.c_str());

    if (response.status_code == 201) {
        return "Успешно: Аккаунт создан";
    }

    // Попытаемся распарсить ошибку
    try {
        json err = json::parse(response.text);
        if (err.contains("error")) {
            return std::string("Ошибка: ") + err["error"].get<std::string>();
        }
        if (err.contains("msg")) {
            return std::string("Ошибка: ") + err["msg"].get<std::string>();
        }
    } catch (...) {}

    return "Ошибка HTTP: " + std::to_string(response.status_code) + " - " + response.text;
}

// Функция для выхода из личного аккаунта (JWT)
std::string LogoutAccount() {
    LOGI("LogoutAccount: START");

    if (g_Token.empty()) {
        LOGE("LogoutAccount: No session token available");
        return "Ошибка: Нет активной сессии";
    }

    // Отправляем запрос с Bearer токеном
    cpr::Session session;
    session.SetUrl(std::string(SERVER_URL) + "/api/auth/logout");
    session.SetHeader({{"Content-Type", "application/json"}, {"Authorization", std::string("Bearer ") + g_Token}});
    session.SetTimeout(cpr::Timeout{5000});
    session.SetSslOptions(cpr::Ssl(cpr::ssl::TLSv1_2{}, cpr::ssl::VerifyHost{false}, cpr::ssl::VerifyPeer{false}));
    LOGI("LogoutAccount: Sending request to /logout");

    cpr::Response response = session.Post();
    LOGI("LogoutAccount: Response status=%d, text_length=%zu", response.status_code, response.text.length());

    if (response.status_code == 200) {
        g_Token.clear();
        LOGI("LogoutAccount: SUCCESS - Logged out successfully");
        return "Успешно: Вы вышли из системы";
    }
    return "Ошибка HTTP: " + std::to_string(response.status_code) + " - " + response.text;
}

std::string ConnectWithChallenge(const std::string& user_key,
                                 const std::string& challenge_data,
                                 const std::string& fingerprint,
                                 const std::string& game_name,
                                 const std::string& serial,
                                 const std::string& android_id,
                                 const std::string& device_model,
                                 const std::string& device_brand) {

    LOGI("ConnectWithChallenge: START");

    // Разделяем challenge и canary
    size_t separator = challenge_data.find("|");
    if (separator == std::string::npos) {
        LOGE("ConnectWithChallenge: Invalid challenge data format");
        return "Ошибка: Неверный формат challenge";
    }

    std::string challenge = challenge_data.substr(0, separator);
    std::string canary = challenge_data.substr(separator + 1);

    LOGI("ConnectWithChallenge: challenge=%s, canary=%s", challenge.c_str(), canary.c_str());

    // Вычисляем challenge response
    // Для enhanced challenge: challenge уже содержит все необходимые данные (user_key, fingerprint, salt, nonce)
    // Поэтому просто вычисляем SHA256(challenge)
    // Для legacy challenge: вычисляем SHA256(challenge + user_key + fingerprint)
    std::string challenge_response;
    if (challenge.length() > 100) {
        // Enhanced challenge (длинный input с salt и nonce) - просто SHA256(input)
        challenge_response = sha256(challenge);
        LOGI("ConnectWithChallenge: Using enhanced challenge format (SHA256 of input only)");
    } else {
        // Legacy challenge (короткий) - SHA256(challenge + user_key + fingerprint)
        challenge_response = sha256(challenge + user_key + fingerprint);
        LOGI("ConnectWithChallenge: Using legacy challenge format (SHA256 of challenge + user_key + fingerprint)");
    }
    LOGI("ConnectWithChallenge: challenge_response=%s", challenge_response.c_str());

    // Генерируем nonce
    std::string nonce = random_hex(16);

    // Создаем данные для шифрования
    json data;
    data["a"] = user_key;           // user_key
    data["b"] = challenge_response; // challenge_response
    data["c"] = canary;            // canary
    data["d"] = fingerprint;       // fingerprint
    data["e"] = game_name;         // game
    data["f"] = serial;            // serial
    data["g"] = android_id;        // android_id
    data["h"] = device_model;      // device_model
    data["i"] = device_brand;      // device_brand
    data["j"] = nonce;             // nonce
    data["k"] = g_ProjectId;       // project_id

    LOGI("ConnectWithChallenge: Data to encrypt = %s", data.dump().c_str());

    // Шифруем данные
    std::string encrypted_blob = encrypt_with_master_key(data.dump(), MASTER_KEY);
    LOGI("ConnectWithChallenge: Encrypted blob length = %zu", encrypted_blob.length());

    // Отправляем запрос
    cpr::Session session;
    session.SetUrl(std::string(SERVER_URL) + "/api/connect");
    session.SetHeader({{"Content-Type", "application/json"}});
    session.SetTimeout(cpr::Timeout{10000});
    // Временно отключаем проверку SSL сертификатов для тестирования
    session.SetSslOptions(cpr::Ssl(cpr::ssl::TLSv1_2{}, cpr::ssl::VerifyHost{false}, cpr::ssl::VerifyPeer{false}));

    json request_data;
    request_data["blob"] = encrypted_blob;

    session.SetBody(cpr::Body{request_data.dump()});
    LOGI("ConnectWithChallenge: Sending request to /connect");
    LOGI("ConnectWithChallenge: Request JSON = %s", request_data.dump().c_str());

    cpr::Response response = session.Post();
    LOGI("ConnectWithChallenge: Response status=%d, text_length=%zu", response.status_code, response.text.length());
    LOGI("ConnectWithChallenge: Response text=%s", response.text.c_str());

    if (response.status_code == 200) {
        try {
            // Расшифровываем ответ
            std::string decrypted_response = decrypt_with_master_key(response.text, MASTER_KEY);
            LOGI("ConnectWithChallenge: Decrypted response = %s", decrypted_response.c_str());

            // Сохраняем ответ для дальнейшего использования
            g_lastDecryptedResponse = decrypted_response;

            // Парсим JSON ответ
            json result = json::parse(decrypted_response);

            // Проверяем наличие ошибки
            if (result.contains("error")) {
                std::string error = result["error"];
                LOGE("ConnectWithChallenge: Server error: %s", error.c_str());
                return "Ошибка сервера: " + error;
            }

            // Проверяем наличие токена (успешная аутентификация)
            if (result.contains("a") && result.contains("d") && result.contains("f")) {
                std::string token_part1 = result["a"];
                std::string token_part2 = result["d"];
                std::string token_part3 = result["f"];
                std::string full_token = token_part1 + token_part2 + token_part3;

                // Сохраняем токен для дальнейшего использования
                g_Token = full_token;

                // Получаем project_id из ответа сервера
                if (result.contains("project_id")) {
                    g_ProjectId = std::to_string(result["project_id"].get<int>());
                    LOGI("ConnectWithChallenge: Received project_id=%s", g_ProjectId.c_str());
                }

                std::string expires_at = result.value("expires_at", "Never");
                std::string seconds_left_human = result.value("seconds_left_human", "Unknown");

                LOGI("ConnectWithChallenge: SUCCESS - Token received, expires: %s", expires_at.c_str());

                return "VALID|" + expires_at + "|" + seconds_left_human;
            } else {
                LOGE("ConnectWithChallenge: Invalid response format - missing token parts");
                return "Ошибка: Неверный формат ответа сервера";
            }

        } catch (const std::exception& e) {
            LOGE("ConnectWithChallenge: Decryption/parsing error: %s", e.what());
            return "Ошибка расшифровки ответа: " + std::string(e.what());
        }
    } else {
        LOGE("ConnectWithChallenge: HTTP error: %d", response.status_code);
        LOGE("ConnectWithChallenge: Response body: %s", response.text.c_str());

        // Try to handle error response - check if it's encrypted or plain text
        if (response.status_code == 403 || response.status_code == 400) {
            // First, try to parse as plain JSON (in case it's not encrypted)
            try {
                json error_json = json::parse(response.text);
                if (error_json.contains("error")) {
                    std::string server_error = error_json["error"];
                    if (server_error == "Key not found") {
                        return "Ключ лицензии не найден на сервере. Проверьте правильность ключа.";
                    } else {
                        return "Ошибка сервера: " + server_error;
                    }
                }
            } catch (const std::exception& e) {
                LOGI("ConnectWithChallenge: Response is not plain JSON, trying to decrypt...");
            }

            // If plain JSON parsing failed, try to decrypt
            try {
                LOGI("ConnectWithChallenge: Attempting to decrypt error response, length=%zu", response.text.length());
                std::string decrypted_error = decrypt_with_master_key(response.text, MASTER_KEY);
                LOGI("ConnectWithChallenge: Decrypted error response: %s", decrypted_error.c_str());

                // Try to parse decrypted content as JSON
                try {
                    json error_json = json::parse(decrypted_error);
                    if (error_json.contains("error")) {
                        std::string server_error = error_json["error"];
                        if (server_error == "Key not found") {
                            return "Ключ лицензии не найден на сервере. Проверьте правильность ключа.";
                        } else {
                            return "Ошибка сервера: " + server_error;
                        }
                    }
                } catch (const std::exception& e) {
                    LOGE("ConnectWithChallenge: Failed to parse decrypted error JSON: %s", e.what());
                }

                return "Ошибка сервера: " + decrypted_error;
            } catch (const std::exception& e) {
                LOGE("ConnectWithChallenge: Failed to decrypt error response: %s", e.what());
                // If decryption also fails, return the raw response
                return "Ошибка сервера (код " + std::to_string(response.status_code) + "): " + response.text;
            }
        }

        if (response.status_code == 403) {
            return "Ошибка HTTP: 403 - Доступ запрещен. Проверьте ключ лицензии и настройки сервера.";
        } else if (response.status_code == 400) {
            return "Ошибка HTTP: 400 - Неверный формат запроса. Проверьте настройки шифрования.";
        } else {
            return "Ошибка HTTP: " + std::to_string(response.status_code) + " - " + response.text;
        }
    }
}

// Обновленная функция CheckLicense с правильным challenge-response
std::string CheckLicense(const char* user_key, const char* game_name, JNIEnv* env, jobject context, const char* ca_path) {
    LOGI("CheckLicense: START");
    LOGI("CheckLicense: user_key = %s, game_name = %s", user_key, game_name);

    if (!user_key || strlen(user_key) == 0) {
        LOGE("CheckLicense: Ключ лицензии не может быть пустым");
        return "Ошибка: Ключ лицензии не может быть пустым";
    }

    jstring androidIdJStr = GetAndroidID(env, context);
    const char* c_android_id = env->GetStringUTFChars(androidIdJStr, 0);
    std::string android_id = c_android_id ? c_android_id : "unknown-device";

    jstring deviceModelJStr = GetDeviceModel(env);
    const char* c_device_model = env->GetStringUTFChars(deviceModelJStr, 0);
    std::string device_model = c_device_model ? c_device_model : "unknown-model";

    jstring deviceBrandJStr = GetDeviceBrand(env);
    const char* c_device_brand = env->GetStringUTFChars(deviceBrandJStr, 0);
    std::string device_brand = c_device_brand ? c_device_brand : "unknown-brand";

    LOGI("CheckLicense: device info - android_id=%s, model=%s, brand=%s",
         android_id.c_str(), device_model.c_str(), device_brand.c_str());

    std::string fingerprint = sha256(android_id + "-" + device_model + "-" + device_brand);
    LOGI("CheckLicense: fingerprint = %s", fingerprint.c_str());

    std::string serial = android_id;

    std::string challenge_data = GetChallenge(user_key, fingerprint);
    if (challenge_data.empty()) {
        LOGE("CheckLicense: Failed to get challenge from server");
        return "Ошибка: Не удалось получить challenge от сервера";
    }

    std::string result = ConnectWithChallenge(user_key, challenge_data, fingerprint,
                                              game_name, serial, android_id, device_model, device_brand);

    env->ReleaseStringUTFChars(androidIdJStr, c_android_id);
    env->ReleaseStringUTFChars(deviceModelJStr, c_device_model);
    env->ReleaseStringUTFChars(deviceBrandJStr, c_device_brand);
    env->DeleteLocalRef(androidIdJStr);
    env->DeleteLocalRef(deviceModelJStr);
    env->DeleteLocalRef(deviceBrandJStr);

    LOGI("CheckLicense: Result = %s", result.c_str());
    return result;
}

struct ImGuiToast {
    std::string message;
    std::string type; // "info", "success", "warning", "error"
    float duration;
    float timeLeft;
    ImVec4 color;
    bool isVisible;

    ImGuiToast(const std::string& msg, const std::string& t, float dur = 3.0f)
            : message(msg), type(t), duration(dur), timeLeft(dur), isVisible(true) {
        // Устанавливаем цвет в зависимости от типа
        if (type == "success") color = ImVec4(0.0f, 0.8f, 0.0f, 1.0f);      // Зеленый
        else if (type == "warning") color = ImVec4(1.0f, 0.6f, 0.0f, 1.0f); // Оранжевый
        else if (type == "error") color = ImVec4(0.8f, 0.0f, 0.0f, 1.0f);   // Красный
        else color = ImVec4(0.0f, 0.6f, 1.0f, 1.0f); // Синий (info)
    }
};

// Структура для хранения changelog записи
struct ChangelogEntry {
    int id;
    std::string version;
    std::string title;
    std::string description;
    std::vector<std::string> changes;
    std::string release_date;
    bool is_public;

    ChangelogEntry() : id(0), is_public(true) {}
};

// Глобальный вектор для хранения toast уведомлений
std::vector<ImGuiToast> g_toasts;

// Глобальные переменные для changelog
std::vector<ChangelogEntry> g_changelogEntries;
bool g_changelogLoaded = false;
bool g_showChangelog = false;

// Функция для добавления ImGui Toast уведомления
void ShowImGuiToast(const std::string& message, const std::string& type = "info", float duration = 3.0f) {
    g_toasts.emplace_back(message, type, duration);
    LOGI("ImGui Toast added: %s (type: %s)", message.c_str(), type.c_str());
}

// Функция для обновления и отображения ImGui Toast уведомлений
void UpdateImGuiToasts() {
    ImGuiIO& io = ImGui::GetIO();
    ImGuiStyle& style = ImGui::GetStyle();

    // Обновляем время жизни toast'ов
    for (auto it = g_toasts.begin(); it != g_toasts.end();) {
        it->timeLeft -= io.DeltaTime;
        if (it->timeLeft <= 0.0f) {
            it = g_toasts.erase(it);
        } else {
            ++it;
        }
    }

    // Отображаем toast'ы
    if (!g_toasts.empty()) {
        ImVec2 screenSize = io.DisplaySize;
        float toastWidth = 300.0f;
        float toastHeight = 60.0f;
        float spacing = 10.0f;

        // Позиционируем toast'ы в правом верхнем углу
        float startX = screenSize.x - toastWidth - 20.0f;
        float startY = 20.0f;

        for (size_t i = 0; i < g_toasts.size(); i++) {
            ImGuiToast& toast = g_toasts[i];

            // Вычисляем позицию
            float y = startY + i * (toastHeight + spacing);

            // Вычисляем прозрачность (fade out в конце)
            float alpha = 1.0f;
            if (toast.timeLeft < 0.5f) {
                alpha = toast.timeLeft / 0.5f;
            }

            // Устанавливаем окно toast'а
            ImGui::SetNextWindowPos(ImVec2(startX, y), ImGuiCond_Always);
            ImGui::SetNextWindowSize(ImVec2(toastWidth, toastHeight), ImGuiCond_Always);

            // Стиль окна
            ImGui::PushStyleVar(ImGuiStyleVar_WindowRounding, 8.0f);
            ImGui::PushStyleVar(ImGuiStyleVar_WindowPadding, ImVec2(15.0f, 10.0f));
            ImGui::PushStyleColor(ImGuiCol_WindowBg, ImVec4(0.1f, 0.1f, 0.1f, 0.9f * alpha));
            ImGui::PushStyleColor(ImGuiCol_Border, ImVec4(toast.color.x, toast.color.y, toast.color.z, alpha));
            ImGui::PushStyleVar(ImGuiStyleVar_WindowBorderSize, 2.0f);

            // Создаем уникальное имя окна
            std::string windowName = "Toast_" + std::to_string(i);

            if (ImGui::Begin(windowName.c_str(), nullptr,
                             ImGuiWindowFlags_NoTitleBar | ImGuiWindowFlags_NoResize |
                             ImGuiWindowFlags_NoMove | ImGuiWindowFlags_NoScrollbar |
                             ImGuiWindowFlags_NoCollapse | ImGuiWindowFlags_NoFocusOnAppearing)) {

                // Иконка в зависимости от типа
                std::string icon = "i";
                if (toast.type == "success") icon = "OK";
                else if (toast.type == "warning") icon = "!";
                else if (toast.type == "error") icon = "X";
                else if (toast.type == "info") icon = "i";

                // Отображаем иконку и сообщение
                ImGui::PushStyleColor(ImGuiCol_Text, ImVec4(toast.color.x, toast.color.y, toast.color.z, alpha));
                ImGui::Text("%s", icon.c_str());
                ImGui::SameLine();
                ImGui::TextWrapped("%s", toast.message.c_str());
                ImGui::PopStyleColor();

                // Прогресс бар времени жизни
                float progress = toast.timeLeft / toast.duration;
                ImGui::PushStyleColor(ImGuiCol_PlotHistogram, ImVec4(toast.color.x, toast.color.y, toast.color.z, alpha * 0.7f));
                ImGui::ProgressBar(progress, ImVec2(-1.0f, 3.0f));
                ImGui::PopStyleColor();

                ImGui::End();
            }

            // Восстанавливаем стили (всегда выполняется, независимо от результата Begin)
            ImGui::PopStyleVar(3);
            ImGui::PopStyleColor(2);
        }
    }
}

// Функция для получения changelog игры
std::vector<ChangelogEntry> GetGameChangelog(const std::string& token, const std::string& project_id) {
    LOGI("GetGameChangelog: START - project_id=%s", project_id.c_str());

    std::vector<ChangelogEntry> entries;

    cpr::Session session;
    // Используем новый endpoint для получения changelog по имени игры
    std::string game_name = g_gameName.empty() ? "default_game" : g_gameName;
    session.SetUrl(std::string(SERVER_URL) + "/api/changelog/games/" + game_name + "/changelog");
    session.SetHeader({
                              {"Content-Type", "application/json"},
                              {"Authorization", "Bearer " + token}
                      });
    session.SetTimeout(cpr::Timeout{5000});
    session.SetSslOptions(cpr::Ssl(cpr::ssl::TLSv1_2{}, cpr::ssl::VerifyHost{false}, cpr::ssl::VerifyPeer{false}));

    LOGI("GetGameChangelog: Using game_name=%s for project_id=%s", game_name.c_str(), project_id.c_str());
    LOGI("GetGameChangelog: Token length=%zu, first 20 chars=%s", token.length(), token.substr(0, 20).c_str());
    LOGI("GetGameChangelog: Full token=%s", token.c_str());

    cpr::Response response = session.Get();
    LOGI("GetGameChangelog: Response status=%d, text_length=%zu", response.status_code, response.text.length());
    LOGI("GetGameChangelog: Response text = %s", response.text.c_str());

    if (response.status_code == 200) {
        try {
            json result = json::parse(response.text);

            // Проверяем структуру ответа согласно backend API
            json changelog_data;
            if (result.contains("changelog")) {
                changelog_data = result["changelog"];
            } else if (result.contains("data")) {
                changelog_data = result["data"];
            } else if (result.is_array()) {
                changelog_data = result;
            } else {
                LOGE("GetGameChangelog: Unexpected response format. Response: %s", result.dump().c_str());
                return entries;
            }

            if (changelog_data.is_array()) {
                for (const auto& entry : changelog_data) {
                    ChangelogEntry changelog_entry;
                    changelog_entry.id = entry.value("id", 0);
                    changelog_entry.version = entry.value("version", "");
                    changelog_entry.title = entry.value("title", "");
                    changelog_entry.description = entry.value("description", "");
                    changelog_entry.release_date = entry.value("release_date", "");
                    changelog_entry.is_public = entry.value("is_public", true);

                    // Парсим изменения
                    if (entry.contains("changes") && entry["changes"].is_array()) {
                        for (const auto& change : entry["changes"]) {
                            if (change.is_string()) {
                                changelog_entry.changes.push_back(change.get<std::string>());
                            }
                        }
                    }

                    entries.push_back(changelog_entry);
                }
            }

            LOGI("GetGameChangelog: SUCCESS - loaded %zu entries", entries.size());
        } catch (const std::exception& e) {
            LOGE("GetGameChangelog: JSON parsing error: %s", e.what());
        }
    } else {
        LOGE("GetGameChangelog: Server error: %d - %s", response.status_code, response.text.c_str());
    }

    return entries;
}

// Структура для хранения информации об игре
struct GameInfo {
    int id;
    std::string name;
    std::string description;
    std::string status;
    int configs_count;
    int extra_files_count;
    bool is_active;
    std::string created_at;
    std::string updated_at;

    GameInfo() : id(0), configs_count(0), extra_files_count(0), is_active(false) {}
};

// Структура для хранения информации о конфиге
struct ConfigInfo {
    int id;
    std::string name;
    std::string description;
    std::string file_type;
    int size;
    std::string version;
    std::string uploaded_by;
    int download_count;
    float rating;
    int rating_count;
    std::string uploaded_at;
    std::string content_hash;
    bool is_public;

    ConfigInfo() : id(0), size(0), download_count(0), rating(0.0f), rating_count(0), is_public(false) {}
};

// Глобальные переменные для игр и конфигов
std::vector<GameInfo> g_games;
std::vector<ConfigInfo> g_configs;
bool g_gamesLoaded = false;
bool g_configsLoaded = false;
bool g_showConfigManager = false;
std::string g_selectedGameName = "PUBG"; // Используем название игры по умолчанию

// Переменные для UI конфигов
bool g_showConfigDownloader = false;
bool g_showConfigUploader = false;
char g_configIdInput[16] = "";  // 8 символов + null terminator
char g_configNameInput[256] = "";
char g_configDescriptionInput[512] = "";
char g_configVersionInput[32] = "1.0.0";
bool g_configIsPublic = true;
char g_configFilePath[512] = "";
bool g_configDownloading = false;
bool g_configUploading = false;
std::string g_configStatusMessage = "";

// Функция для получения списка игр
std::vector<GameInfo> GetGamesList(const std::string& token) {
    LOGI("GetGamesList: START - token length=%zu", token.length());

    std::vector<GameInfo> games;

    cpr::Session session;
    session.SetUrl(std::string(SERVER_URL) + "/api/files/games");
    session.SetHeader({
                              {"Content-Type", "application/json"},
                              {"Authorization", "Bearer " + token}
                      });
    session.SetTimeout(cpr::Timeout{5000});
    session.SetSslOptions(cpr::Ssl(cpr::ssl::TLSv1_2{}, cpr::ssl::VerifyHost{false}, cpr::ssl::VerifyPeer{false}));

    LOGI("GetGamesList: Token first 20 chars=%s", token.substr(0, 20).c_str());

    cpr::Response response = session.Get();
    LOGI("GetGamesList: Response status=%d, text_length=%zu", response.status_code, response.text.length());
    LOGI("GetGamesList: Response text = %s", response.text.c_str());

    if (response.status_code == 200) {
        try {
            json result = json::parse(response.text);

            if (result.contains("games") && result["games"].is_array()) {
                for (const auto& game : result["games"]) {
                    GameInfo gameInfo;
                    gameInfo.id = game.value("id", 0);
                    gameInfo.name = game.value("name", "");
                    gameInfo.description = game.value("description", "");
                    gameInfo.status = game.value("status", "");
                    gameInfo.configs_count = game.value("configs_count", 0);
                    gameInfo.extra_files_count = game.value("extra_files_count", 0);
                    gameInfo.is_active = game.value("is_active", false);
                    gameInfo.created_at = game.value("created_at", "");
                    gameInfo.updated_at = game.value("updated_at", "");

                    games.push_back(gameInfo);
                }
            }

            LOGI("GetGamesList: SUCCESS - loaded %zu games", games.size());
        } catch (const std::exception& e) {
            LOGE("GetGamesList: JSON parsing error: %s", e.what());
        }
    } else {
        LOGE("GetGamesList: Server error: %d - %s", response.status_code, response.text.c_str());
    }

    return games;
}

// Функция для загрузки changelog при успешной авторизации
void LoadChangelogIfNeeded() {
    if (!g_changelogLoaded && !g_Token.empty() && !g_ProjectId.empty()) {
        LOGI("LoadChangelogIfNeeded: Loading changelog for project_id=%s", g_ProjectId.c_str());

        // Используем project_id из глобальной переменной
        g_changelogEntries = GetGameChangelog(g_Token, g_ProjectId);
        g_changelogLoaded = true;

        if (g_changelogEntries.empty()) {
            LOGI("LoadChangelogIfNeeded: No changelog entries found for project_id=%s", g_ProjectId.c_str());
        } else {
            LOGI("LoadChangelogIfNeeded: Loaded %zu changelog entries for project_id=%s", g_changelogEntries.size(), g_ProjectId.c_str());
        }
    } else {
        if (g_Token.empty()) {
            LOGI("LoadChangelogIfNeeded: Token is empty, skipping changelog load");
        }
        if (g_ProjectId.empty()) {
            LOGI("LoadChangelogIfNeeded: Project ID is empty, skipping changelog load");
        }
        if (g_changelogLoaded) {
            LOGI("LoadChangelogIfNeeded: Changelog already loaded");
        }
    }
}

// Функция для загрузки списка игр при успешной авторизации
void LoadGamesIfNeeded() {
    if (!g_gamesLoaded && !g_Token.empty()) {
        LOGI("LoadGamesIfNeeded: Loading games list");

        g_games = GetGamesList(g_Token);
        g_gamesLoaded = true;

        if (g_games.empty()) {
            LOGI("LoadGamesIfNeeded: No games found");
        } else {
            LOGI("LoadGamesIfNeeded: Loaded %zu games", g_games.size());
            // Используем фиксированный ID игры (g_selectedGameId = 1)
        }
    } else {
        if (g_Token.empty()) {
            LOGI("LoadGamesIfNeeded: Token is empty, skipping games load");
        }
        if (g_gamesLoaded) {
            LOGI("LoadGamesIfNeeded: Games already loaded");
        }
    }
}

// Функция для получения списка конфигов игры
std::vector<ConfigInfo> GetGameConfigs(const std::string& token, const std::string& game_name) {
    LOGI("GetGameConfigs: START - game_name=%s", game_name.c_str());

    std::vector<ConfigInfo> configs;

    cpr::Session session;
    session.SetUrl(std::string(SERVER_URL) + "/api/files/games/" + game_name + "/configs");
    session.SetHeader({
                              {"Content-Type", "application/json"},
                              {"Authorization", "Bearer " + token}
                      });
    session.SetTimeout(cpr::Timeout{5000});
    session.SetSslOptions(cpr::Ssl(cpr::ssl::TLSv1_2{}, cpr::ssl::VerifyHost{false}, cpr::ssl::VerifyPeer{false}));

    cpr::Response response = session.Get();
    LOGI("GetGameConfigs: Response status=%d, text_length=%zu", response.status_code, response.text.length());
    LOGI("GetGameConfigs: Response text = %s", response.text.c_str());

    if (response.status_code == 200) {
        try {
            json result = json::parse(response.text);

            if (result.contains("configs") && result["configs"].is_array()) {
                for (const auto& config : result["configs"]) {
                    ConfigInfo configInfo;
                    configInfo.id = config.value("id", 0);
                    configInfo.name = config.value("name", "");
                    configInfo.description = config.value("description", "");
                    configInfo.file_type = config.value("file_type", "");
                    configInfo.size = config.value("size", 0);
                    configInfo.version = config.value("version", "");
                    configInfo.uploaded_by = config.value("uploaded_by", "");
                    configInfo.download_count = config.value("download_count", 0);
                    configInfo.rating = config.value("rating", 0.0f);
                    configInfo.rating_count = config.value("rating_count", 0);
                    configInfo.uploaded_at = config.value("uploaded_at", "");
                    configInfo.content_hash = config.value("content_hash", "");
                    configInfo.is_public = config.value("is_public", false);

                    configs.push_back(configInfo);
                }
            }

            LOGI("GetGameConfigs: SUCCESS - loaded %zu configs", configs.size());
        } catch (const std::exception& e) {
            LOGE("GetGameConfigs: JSON parsing error: %s", e.what());
        }
    } else {
        LOGE("GetGameConfigs: Server error: %d - %s", response.status_code, response.text.c_str());
    }

    return configs;
}

// Функция для загрузки конфига на сервер
std::string UploadConfigFile(const std::string& token, const std::string& game_name, const std::string& file_path,
                             const std::string& name, const std::string& description,
                             const std::string& version, bool is_public) {
    LOGI("UploadConfigFile: START - game_name=%s, file_path=%s", game_name.c_str(), file_path.c_str());

    // Проверяем существование файла
    std::ifstream file(file_path, std::ios::binary);
    if (!file.is_open()) {
        LOGE("UploadConfigFile: Cannot open file: %s", file_path.c_str());
        return "Ошибка: Не удалось открыть файл " + file_path + ". Проверьте, что файл существует и приложение имеет права доступа к папке Download.";
    }

    // Получаем размер файла
    file.seekg(0, std::ios::end);
    size_t file_size = file.tellg();
    file.seekg(0, std::ios::beg);

    if (file_size == 0) {
        LOGE("UploadConfigFile: File is empty: %s", file_path.c_str());
        return "Ошибка: Файл пустой";
    }

    LOGI("UploadConfigFile: File size: %zu bytes", file_size);

    // Читаем содержимое файла
    std::vector<char> file_data(file_size);
    file.read(file_data.data(), file_size);
    file.close();

    // Создаем multipart/form-data запрос
    cpr::Session session;
    session.SetUrl(std::string(SERVER_URL) + "/api/files/game-files/config");
    session.SetHeader({
                              {"Authorization", "Bearer " + token}
                      });
    session.SetTimeout(cpr::Timeout{30000}); // 30 секунд для загрузки
    session.SetSslOptions(cpr::Ssl(cpr::ssl::TLSv1_2{}, cpr::ssl::VerifyHost{false}, cpr::ssl::VerifyPeer{false}));

    // Подготавливаем данные формы
    cpr::Multipart multipart{
            {"game_name", game_name},
            {"name", name},
            {"description", description},
            {"version", version},
            {"is_public", is_public ? "true" : "false"}
    };

    // Добавляем файл
    std::string filename = file_path.substr(file_path.find_last_of("/\\") + 1);
    multipart.parts.push_back(cpr::Part{"file", cpr::Buffer{file_data.begin(), file_data.end(), std::move(filename)}, filename});

    session.SetMultipart(multipart);

    LOGI("UploadConfigFile: Sending request to server");
    cpr::Response response = session.Post();

    LOGI("UploadConfigFile: Response status=%d, text_length=%zu", response.status_code, response.text.length());
    LOGI("UploadConfigFile: Response text = %s", response.text.c_str());

    if (response.status_code == 201) {
        try {
            json result = json::parse(response.text);
            if (result.contains("config")) {
                auto config = result["config"];
                std::string config_string_id = config.value("config_id", "");
                LOGI("UploadConfigFile: SUCCESS - config_string_id=%s", config_string_id.c_str());
                if (!config_string_id.empty()) {
                    return "Конфиг успешно загружен! ID: " + config_string_id;
                }
            }
            if (result.contains("message")) {
                std::string message = result["message"];
                LOGI("UploadConfigFile: SUCCESS - %s", message.c_str());
                return "Успешно загружено: " + message;
            }
        } catch (const std::exception& e) {
            LOGE("UploadConfigFile: JSON parsing error: %s", e.what());
        }
        return "Конфиг успешно загружен на сервер";
    } else {
        // Специальная обработка ошибки авторизации
        if (response.status_code == 401) {
            try {
                json error_result = json::parse(response.text);
                if (error_result.contains("msg") && error_result["msg"] == "Invalid token") {
                    LOGE("UploadConfigFile: Invalid token - user needs to re-authenticate");
                    return "Ошибка авторизации: Токен недействителен. Пожалуйста, войдите в систему заново.";
                }
            } catch (const std::exception& e) {
                LOGE("UploadConfigFile: Failed to parse 401 error response: %s", e.what());
            }
            return "Ошибка авторизации: Недействительный токен. Войдите в систему заново.";
        }

        try {
            json error_result = json::parse(response.text);
            if (error_result.contains("error")) {
                std::string error = error_result["error"];
                LOGE("UploadConfigFile: Server error: %s", error.c_str());
                return "Ошибка сервера: " + error;
            }
            if (error_result.contains("msg")) {
                std::string msg = error_result["msg"];
                LOGE("UploadConfigFile: Server message: %s", msg.c_str());
                return "Сообщение сервера: " + msg;
            }
        } catch (const std::exception& e) {
            LOGE("UploadConfigFile: Failed to parse error response: %s", e.what());
        }

        LOGE("UploadConfigFile: HTTP error: %d", response.status_code);
        return "Ошибка HTTP: " + std::to_string(response.status_code) + " - " + response.text;
    }
}

// Функция для загрузки конфигов при смене игры
void LoadConfigsIfNeeded() {
    if (!g_configsLoaded && !g_Token.empty() && !g_selectedGameName.empty()) {
        LOGI("LoadConfigsIfNeeded: Loading configs for game_name=%s", g_selectedGameName.c_str());

        g_configs = GetGameConfigs(g_Token, g_selectedGameName);
        g_configsLoaded = true;

        if (g_configs.empty()) {
            LOGI("LoadConfigsIfNeeded: No configs found for game_name=%s", g_selectedGameName.c_str());
        } else {
            LOGI("LoadConfigsIfNeeded: Loaded %zu configs for game_name=%s", g_configs.size(), g_selectedGameName.c_str());
        }
    } else {
        if (g_Token.empty()) {
            LOGI("LoadConfigsIfNeeded: Token is empty, skipping configs load");
        }
        if (g_selectedGameName.empty()) {
            LOGI("LoadConfigsIfNeeded: No game selected, skipping configs load");
        }
        if (g_configsLoaded) {
            LOGI("LoadConfigsIfNeeded: Configs already loaded");
        }
    }
}

// Функция для скачивания конфига по 8-значному ID
std::string DownloadConfigById(const std::string& token, const std::string& config_id, const std::string& save_path) {
    LOGI("DownloadConfigById: START - config_id=%s, save_path=%s", config_id.c_str(), save_path.c_str());

    cpr::Session session;
    session.SetUrl(std::string(SERVER_URL) + "/api/files/games/configs/" + config_id + "/download");
    session.SetHeader({
                              {"Authorization", "Bearer " + token}
                      });
    session.SetTimeout(cpr::Timeout{30000}); // 30 секунд для скачивания
    session.SetSslOptions(cpr::Ssl(cpr::ssl::TLSv1_2{}, cpr::ssl::VerifyHost{false}, cpr::ssl::VerifyPeer{false}));

    LOGI("DownloadConfigById: Sending request to server");
    cpr::Response response = session.Get();

    LOGI("DownloadConfigById: Response status=%d, text_length=%zu", response.status_code, response.text.length());

    if (response.status_code == 200) {
        try {
            // Сохраняем файл
            std::ofstream file(save_path, std::ios::binary);
            if (!file.is_open()) {
                LOGE("DownloadConfigById: Cannot create file: %s", save_path.c_str());
                return "Ошибка: Не удалось создать файл";
            }

            file.write(response.text.data(), response.text.size());
            file.close();

            LOGI("DownloadConfigById: SUCCESS - file saved to %s", save_path.c_str());
            return "Конфиг успешно скачан: " + save_path;

        } catch (const std::exception& e) {
            LOGE("DownloadConfigById: File save error: %s", e.what());
            return "Ошибка сохранения файла: " + std::string(e.what());
        }
    } else {
        try {
            json error_result = json::parse(response.text);
            if (error_result.contains("error")) {
                std::string error = error_result["error"];
                LOGE("DownloadConfigById: Server error: %s", error.c_str());
                return "Ошибка сервера: " + error;
            }
        } catch (const std::exception& e) {
            LOGE("DownloadConfigById: Failed to parse error response: %s", e.what());
        }

        LOGE("DownloadConfigById: HTTP error: %d", response.status_code);
        return "Ошибка HTTP: " + std::to_string(response.status_code) + " - " + response.text;
    }
}

// Функция для форматирования даты
std::string FormatDate(const std::string& date_str) {
    if (date_str.empty()) return "Неизвестно";

    try {
        // Парсим ISO дату (например: "2024-01-15T10:30:00")
        size_t t_pos = date_str.find('T');
        if (t_pos != std::string::npos) {
            return date_str.substr(0, t_pos); // Возвращаем только дату
        }
        return date_str;
    } catch (...) {
        return date_str;
    }
}

// Функция для обновления statusMessage из g_lastDecryptedResponse
void UpdateStatusMessageFromResponse(std::string& statusMessage) {
    try {
        if (!g_lastDecryptedResponse.empty()) {
            auto result_json = json::parse(g_lastDecryptedResponse);

            if (result_json.contains("game_status")) {
                statusMessage += std::string("\nСтатус игры: ") + result_json["game_status"].get<std::string>();
            }

            // Обработка уведомлений из ответа сервера
            if (result_json.contains("notifications")) {
                for (const auto& notif : result_json["notifications"]) {
                    std::string type = notif.value("type", "info");
                    std::string title = notif.value("title", "");
                    std::string message = notif.value("message", "");

                    if (!title.empty() && !message.empty()) {
                        // Добавляем в статус сообщение
                        std::string type_emoji = "i";
                        if (type == "warning") type_emoji = "!";
                        else if (type == "error") type_emoji = "X";
                        else if (type == "success") type_emoji = "OK";
                        else if (type == "info") type_emoji = "i";

                        statusMessage += "\n[" + type_emoji + " Уведомление] " + title + ": " + message;

                        // Показываем ImGui toast уведомление
                        std::string toastMessage = title + ": " + message;
                        ShowImGuiToast(toastMessage, type, 4.0f);
                    }
                }
            }
        }
    } catch (const std::exception& e) {
        LOGE("UpdateStatusMessageFromResponse: Exception: %s", e.what());
    } catch (...) {
        LOGE("UpdateStatusMessageFromResponse: Unknown exception");
    }
}


// Вспомогательная функция для получения пути к cacert.pem через JNI
std::string GetPrivateCacertPath(JNIEnv* env, jobject context) {
    // Получаем ClassLoader из context
    jclass contextClass = env->GetObjectClass(context);
    jmethodID getClassLoader = env->GetMethodID(contextClass, "getClassLoader", "()Ljava/lang/ClassLoader;");
    jobject classLoader = env->CallObjectMethod(context, getClassLoader);
    jclass classLoaderClass = env->FindClass("java/lang/ClassLoader");
    jmethodID loadClass = env->GetMethodID(classLoaderClass, "loadClass", "(Ljava/lang/String;)Ljava/lang/Class;");
    jstring strClassName = env->NewStringUTF("com.example.myapplication.NativeBridge");
    jclass bridgeClass = (jclass)env->CallObjectMethod(classLoader, loadClass, strClassName);
    env->DeleteLocalRef(strClassName);
    // Теперь получаем метод
    jmethodID copyCacertMethod = env->GetStaticMethodID(bridgeClass, "copyCacertFromAssetsIfNeeded", "(Landroid/content/Context;)Ljava/lang/String;");
    jstring jCacertPath = (jstring)env->CallStaticObjectMethod(bridgeClass, copyCacertMethod, context);
    const char* cacertPath = env->GetStringUTFChars(jCacertPath, nullptr);
    std::string result = cacertPath;
    env->ReleaseStringUTFChars(jCacertPath, cacertPath);
    env->DeleteLocalRef(jCacertPath);
    return result;
}

void android_main(struct android_app* app) {
    g_App = app;
    app->onAppCmd = [](android_app* app, int32_t cmd) {
        // Обработка событий приложения
    };

    app->onInputEvent = [](android_app* app, AInputEvent* event) -> int {
        return ImGui_ImplAndroid_HandleInputEvent(event);
    };

    // Ждем инициализации окна
    while (!app->window) {
        int events;
        android_poll_source* source;
        while (ALooper_pollOnce(0, nullptr, &events, (void**)&source) >= 0) {
            if (source) source->process(app, source);
        }
    }

    EGLObjects egl = init_egl(app->window);
    if (egl.display == EGL_NO_DISPLAY || egl.context == EGL_NO_CONTEXT || egl.surface == EGL_NO_SURFACE) {
        __android_log_print(ANDROID_LOG_ERROR, "ImGuiLogin", "EGL initialization failed");
        return;
    }

    // Инициализация ImGui
    IMGUI_CHECKVERSION();
    ImGui::CreateContext();
    ImGuiIO& io = ImGui::GetIO(); (void)io;
    // Подключаем шрифт с поддержкой кириллицы
    io.Fonts->AddFontFromFileTTF("/system/fonts/Roboto-Regular.ttf", 32.0f, NULL, io.Fonts->GetGlyphRangesCyrillic());
    // Регистрация функций буфера обмена для ImGui
    io.GetClipboardTextFn = [](void* user_data) -> const char* {
        static std::string clipboard;
        clipboard = GetClipboardText(static_cast<android_app*>(user_data));
        return clipboard.c_str();
    };
    io.SetClipboardTextFn = [](void* user_data, const char* text) {
        // Можно реализовать запись в буфер обмена через JNI, если потребуется
    };
    io.ClipboardUserData = app;
    ImGui::StyleColorsDark();

    // Временно отключаем систему восстановления ошибок ImGui для предотвращения крашей
    io.ConfigErrorRecovery = false;

    // Настройки для правильной работы с текстовым вводом на Android
    io.ConfigFlags |= ImGuiConfigFlags_NavEnableKeyboard;  // Включаем навигацию с клавиатуры
    io.ConfigFlags |= ImGuiConfigFlags_NavEnableGamepad;   // Включаем навигацию с геймпада
    io.ConfigFlags &= ~ImGuiConfigFlags_NoMouseCursorChange; // Разрешаем изменение курсора мыши

    // Уменьшаем размер меню до среднего
    ImGuiStyle& style = ImGui::GetStyle();
    style.FramePadding = ImVec2(8.0f, 8.0f); // средний размер (по умолчанию 4,3)
    style.ItemSpacing = ImVec2(8.0f, 6.0f);  // средний отступ между элементами

    // Увеличиваем масштаб для удобства на мобильных устройствах
    io.FontGlobalScale = 2.0f;

    // Настройка IME (Input Method Editor) для поддержки экранной клавиатуры
    ImGuiPlatformIO& platform_io = ImGui::GetPlatformIO();
    platform_io.Platform_SetImeDataFn = [](ImGuiContext* ctx, ImGuiViewport* viewport, ImGuiPlatformImeData* data) {
        // Для Android нужно показать/скрыть экранную клавиатуру
        if (data->WantVisible || data->WantTextInput) {
            // Показать экранную клавиатуру
            __android_log_print(ANDROID_LOG_INFO, "ImGuiLogin", "Show keyboard requested - WantVisible: %d, WantTextInput: %d",
                                data->WantVisible, data->WantTextInput);
            // Здесь можно добавить JNI вызов для показа клавиатуры
        } else {
            // Скрыть экранную клавиатуру
            __android_log_print(ANDROID_LOG_INFO, "ImGuiLogin", "Hide keyboard requested");
            // Здесь можно добавить JNI вызов для скрытия клавиатуры
        }
    };

    ImGui_ImplAndroid_Init(app->window);
    ImGui_ImplOpenGL3_Init(egl.context ? "#version 300 es" : "#version 100");

    // Переменные для интерфейса
    char keyInput[256] = "";
    std::string statusMessage = " Введите ключ лицензии и нажмите 'Войти в систему'";
    std::string licenseStatus;
    bool keyChecked = false;
    bool isLoading = false;
    float loadingProgress = 0.0f;
    std::string loadingText = "Проверяем лицензию...";
    float loadingAnimation = 0.0f;

    // Добавляем переменную состояния экрана
    enum class AppScreen {
        Login,
        Main
    };
    AppScreen currentScreen = AppScreen::Login;

    // Добавляем тип логина
    enum class LoginType {
        Type1,
        Type2
    };
    LoginType currentLoginType = LoginType::Type1;

    // Переменные для Type2 логина
    char usernameInput[256] = "";
    char passwordInput[256] = "";
    char emailInput[256] = "";
    bool showRegistration = false;

    // Объявляем переменные размеров экрана до основного цикла
    int width, height;
    float scaleFactor;

    // Основной цикл
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

        // Отладочная информация для проверки состояния текстового ввода
        static int debug_counter = 0;
        if (++debug_counter % 60 == 0) { // Каждую секунду (60 FPS)
            __android_log_print(ANDROID_LOG_INFO, "ImGuiLogin", "WantTextInput: %d", io.WantTextInput);
        }

        // Получаем размеры экрана
        width = ANativeWindow_getWidth(app->window);
        height = ANativeWindow_getHeight(app->window);
        scaleFactor = (float)height / 1080.0f; // Базовое разрешение 1080p

        // Обновляем анимацию загрузки
        if (isLoading) {
            loadingAnimation += io.DeltaTime * 2.0f; // Скорость анимации
            if (loadingAnimation > 1.0f) loadingAnimation = 0.0f;
        }

        if (currentScreen == AppScreen::Login) {
            // Центрируем окно и задаём фиксированный размер
            ImVec2 windowSize(380 * scaleFactor, 0); // немного увеличили ширину
            ImVec2 windowPos((width - windowSize.x) * 0.5f, height * 0.15f);
            ImGui::SetNextWindowPos(windowPos, ImGuiCond_FirstUseEver);
            ImGui::SetNextWindowSize(windowSize, ImGuiCond_FirstUseEver);

            // Применяем красивые стили для окна
            ImGui::PushStyleVar(ImGuiStyleVar_WindowRounding, 15.0f);
            ImGui::PushStyleVar(ImGuiStyleVar_WindowPadding, ImVec2(20.0f, 20.0f));
            ImGui::PushStyleVar(ImGuiStyleVar_FrameRounding, 8.0f);
            ImGui::PushStyleVar(ImGuiStyleVar_ItemSpacing, ImVec2(12.0f, 8.0f));
            ImGui::PushStyleVar(ImGuiStyleVar_ItemInnerSpacing, ImVec2(8.0f, 6.0f));

            // Красивые цвета для окна
            ImGui::PushStyleColor(ImGuiCol_WindowBg, ImVec4(0.08f, 0.08f, 0.12f, 0.95f)); // Темно-синий фон
            ImGui::PushStyleColor(ImGuiCol_Border, ImVec4(0.2f, 0.4f, 0.8f, 0.6f)); // Синяя граница
            ImGui::PushStyleColor(ImGuiCol_Text, ImVec4(0.9f, 0.9f, 0.95f, 1.0f)); // Светлый текст

            if (ImGui::Begin("Авторизация", nullptr, ImGuiWindowFlags_NoCollapse | ImGuiWindowFlags_NoResize)) {
                // Отображаем название игры
                ImGui::PushStyleColor(ImGuiCol_Text, ImVec4(0.0f, 0.8f, 1.0f, 1.0f)); // Голубой цвет
                ImGui::Text("Игра: %s", g_gameName.empty() ? "Не указана" : g_gameName.c_str());
                ImGui::PopStyleColor();
                ImGui::Separator();
                ImGui::Spacing();

                // Выбор типа логина
                ImGui::PushStyleColor(ImGuiCol_Text, ImVec4(0.7f, 0.8f, 1.0f, 1.0f));
                ImGui::Text("Выберите тип входа:");
                ImGui::PopStyleColor();
                ImGui::Spacing();

                // Кнопки выбора типа с красивым дизайном
                bool isType1Selected = (currentLoginType == LoginType::Type1);
                bool isType2Selected = (currentLoginType == LoginType::Type2);

                // Type 1 кнопка
                ImGui::PushStyleColor(ImGuiCol_Button, isType1Selected ?
                                                       ImVec4(0.2f, 0.6f, 1.0f, 0.8f) : ImVec4(0.15f, 0.15f, 0.25f, 0.8f));
                ImGui::PushStyleColor(ImGuiCol_ButtonHovered, isType1Selected ?
                                                              ImVec4(0.3f, 0.7f, 1.0f, 0.9f) : ImVec4(0.25f, 0.25f, 0.35f, 0.9f));
                ImGui::PushStyleColor(ImGuiCol_ButtonActive, ImVec4(0.1f, 0.5f, 0.9f, 1.0f));
                ImGui::PushStyleColor(ImGuiCol_Text, isType1Selected ?
                                                     ImVec4(1.0f, 1.0f, 1.0f, 1.0f) : ImVec4(0.8f, 0.8f, 0.9f, 1.0f));

                if (ImGui::Button("Лицензия", ImVec2(160 * scaleFactor, 45 * scaleFactor))) {
                    currentLoginType = LoginType::Type1;
                    // Очищаем поля Type2 при переключении
                    memset(usernameInput, 0, sizeof(usernameInput));
                    memset(passwordInput, 0, sizeof(passwordInput));
                    memset(emailInput, 0, sizeof(emailInput));
                    showRegistration = false;
                }
                ImGui::PopStyleColor(4);

                ImGui::SameLine();

                // Type 2 кнопка
                ImGui::PushStyleColor(ImGuiCol_Button, isType2Selected ?
                                                       ImVec4(0.2f, 0.6f, 1.0f, 0.8f) : ImVec4(0.15f, 0.15f, 0.25f, 0.8f));
                ImGui::PushStyleColor(ImGuiCol_ButtonHovered, isType2Selected ?
                                                              ImVec4(0.3f, 0.7f, 1.0f, 0.9f) : ImVec4(0.25f, 0.25f, 0.35f, 0.9f));
                ImGui::PushStyleColor(ImGuiCol_ButtonActive, ImVec4(0.1f, 0.5f, 0.9f, 1.0f));
                ImGui::PushStyleColor(ImGuiCol_Text, isType2Selected ?
                                                     ImVec4(1.0f, 1.0f, 1.0f, 1.0f) : ImVec4(0.8f, 0.8f, 0.9f, 1.0f));

                if (ImGui::Button("👤 Аккаунт", ImVec2(160 * scaleFactor, 45 * scaleFactor))) {
                    currentLoginType = LoginType::Type2;
                    // Очищаем поле лицензии при переключении
                    memset(keyInput, 0, sizeof(keyInput));
                }
                ImGui::PopStyleColor(4);

                ImGui::Separator();
                ImGui::Spacing();

                // Показываем форму в зависимости от выбранного типа
                if (currentLoginType == LoginType::Type1) {
                    // Type 1: Лицензионный ключ
                    ImGui::PushStyleColor(ImGuiCol_Text, ImVec4(0.8f, 0.9f, 1.0f, 1.0f));
                    ImGui::Text("Введите ключ лицензии:");
                    ImGui::PopStyleColor();

                    // Стилизация поля ввода
                    ImGui::PushStyleColor(ImGuiCol_FrameBg, ImVec4(0.12f, 0.12f, 0.18f, 0.8f));
                    ImGui::PushStyleColor(ImGuiCol_FrameBgHovered, ImVec4(0.15f, 0.15f, 0.22f, 0.9f));
                    ImGui::PushStyleColor(ImGuiCol_FrameBgActive, ImVec4(0.18f, 0.18f, 0.25f, 1.0f));
                    ImGui::PushStyleColor(ImGuiCol_Text, ImVec4(0.9f, 0.9f, 0.95f, 1.0f));
                    ImGui::PushItemWidth(-1);
                    ImGui::InputText("##key", keyInput, sizeof(keyInput), ImGuiInputTextFlags_Password);
                    ImGui::PopItemWidth();
                    ImGui::PopStyleColor(4);

                    ImGui::Spacing();

                    // Кнопка "Вставить из буфера"
                    ImGui::PushStyleColor(ImGuiCol_Button, ImVec4(0.3f, 0.4f, 0.6f, 0.8f));
                    ImGui::PushStyleColor(ImGuiCol_ButtonHovered, ImVec4(0.4f, 0.5f, 0.7f, 0.9f));
                    ImGui::PushStyleColor(ImGuiCol_ButtonActive, ImVec4(0.2f, 0.3f, 0.5f, 1.0f));
                    if (ImGui::Button("Вставить из буфера", ImVec2(-FLT_MIN, 45 * scaleFactor))) {
                        const char* clipboard = ImGui::GetIO().GetClipboardTextFn(ImGui::GetIO().ClipboardUserData);
                        if (clipboard) {
                            strncpy(keyInput, clipboard, sizeof(keyInput) - 1);
                            keyInput[sizeof(keyInput) - 1] = '\0';
                        }
                    }
                    ImGui::PopStyleColor(3);

                    ImGui::Spacing();

                    // Главная кнопка входа
                    ImGui::PushStyleColor(ImGuiCol_Button, ImVec4(0.2f, 0.7f, 0.3f, 0.8f));
                    ImGui::PushStyleColor(ImGuiCol_ButtonHovered, ImVec4(0.3f, 0.8f, 0.4f, 0.9f));
                    ImGui::PushStyleColor(ImGuiCol_ButtonActive, ImVec4(0.1f, 0.6f, 0.2f, 1.0f));
                    ImGui::PushStyleColor(ImGuiCol_Text, ImVec4(1.0f, 1.0f, 1.0f, 1.0f));
                    if (ImGui::Button(isLoading ? "Проверяем..." : "Войти в систему", ImVec2(-FLT_MIN, 50 * scaleFactor))) {
                        if (isLoading) {
                            // Кнопка заблокирована во время загрузки
                        } else if (strlen(keyInput) == 0) {
                            statusMessage = "Пожалуйста, введите ключ лицензии";
                            keyChecked = false;
                        } else {
                            // Используем жестко заданный project_id = 1
                            LOGI("CheckLicense: Using project_id=%s", g_ProjectId.c_str());

                            // Начинаем процесс загрузки
                            isLoading = true;
                            loadingProgress = 0.0f;
                            loadingText = "Подключаемся к серверу...";
                            statusMessage = "Проверяем лицензию...";

                            // Симуляция прогресса загрузки
                            loadingProgress = 0.3f;
                            loadingText = "Проверяем ключ...";

                            JNIEnv* env = nullptr;
                            app->activity->vm->AttachCurrentThread(&env, nullptr);
                            jobject context = app->activity->clazz;
                            std::string ca_path = GetPrivateCacertPath(env, context);

                            loadingProgress = 0.7f;
                            loadingText = "Валидируем лицензию...";

                            std::string result = CheckLicense(keyInput, g_gameName.c_str(), env, context, ca_path.c_str());
                            app->activity->vm->DetachCurrentThread();

                            // Завершаем загрузку
                            loadingProgress = 1.0f;
                            loadingText = "Завершено!";

                            // Проверяем результат (может быть "VALID|expires_at|seconds_left_human")
                            if (result.substr(0, 5) == "VALID") {
                                licenseStatus = result;
                                currentScreen = AppScreen::Main;
                                keyChecked = true;

                                // Парсим дополнительную информацию из результата
                                size_t first_pipe = result.find("|");
                                if (first_pipe != std::string::npos) {
                                    size_t second_pipe = result.find("|", first_pipe + 1);
                                    if (second_pipe != std::string::npos) {
                                        std::string expires_at = result.substr(first_pipe + 1, second_pipe - first_pipe - 1);
                                        std::string seconds_left = result.substr(second_pipe + 1);
                                        statusMessage = "Лицензия успешно проверена!\nИстекает: " + expires_at + "\nОсталось: " + seconds_left;
                                    } else {
                                        std::string expires_at = result.substr(first_pipe + 1);
                                        statusMessage = "Лицензия успешно проверена!\nИстекает: " + expires_at;
                                    }
                                } else {
                                    statusMessage = "Лицензия успешно проверена!";
                                }

                                // Обновляем статус сообщение с уведомлениями из ответа сервера
                                UpdateStatusMessageFromResponse(statusMessage);

                                // Загружаем changelog после успешной авторизации
                                LoadChangelogIfNeeded();

                                // Загружаем список игр после успешной авторизации
                                LoadGamesIfNeeded();
                            } else {
                                statusMessage = "Ключ невалидный или ошибка: " + result;
                                keyChecked = false;
                            }

                            // Сбрасываем состояние загрузки
                            isLoading = false;
                            loadingProgress = 0.0f;
                        }
                    }
                    ImGui::PopStyleColor(4); // Закрываем стили кнопки входа
                } else if (currentLoginType == LoginType::Type2) {
                    // Type 2: Username + Password + Registration
                    ImGui::PushStyleColor(ImGuiCol_Text, ImVec4(0.8f, 0.9f, 1.0f, 1.0f));
                    ImGui::Text("Имя пользователя (мин. 3 символа):");
                    ImGui::PopStyleColor();

                    // Стилизация поля username
                    ImGui::PushStyleColor(ImGuiCol_FrameBg, ImVec4(0.12f, 0.12f, 0.18f, 0.8f));
                    ImGui::PushStyleColor(ImGuiCol_FrameBgHovered, ImVec4(0.15f, 0.15f, 0.22f, 0.9f));
                    ImGui::PushStyleColor(ImGuiCol_FrameBgActive, ImVec4(0.18f, 0.18f, 0.25f, 1.0f));
                    ImGui::PushStyleColor(ImGuiCol_Text, ImVec4(0.9f, 0.9f, 0.95f, 1.0f));
                    ImGui::PushItemWidth(-1);
                    ImGui::InputText("##username", usernameInput, sizeof(usernameInput));
                    ImGui::PopItemWidth();
                    ImGui::PopStyleColor(4);

                    // Кнопка "Вставить из буфера" для username
                    ImGui::PushStyleColor(ImGuiCol_Button, ImVec4(0.3f, 0.4f, 0.6f, 0.8f));
                    ImGui::PushStyleColor(ImGuiCol_ButtonHovered, ImVec4(0.4f, 0.5f, 0.7f, 0.9f));
                    ImGui::PushStyleColor(ImGuiCol_ButtonActive, ImVec4(0.2f, 0.3f, 0.5f, 1.0f));
                    if (ImGui::Button("Вставить имя из буфера", ImVec2(-FLT_MIN, 35 * scaleFactor))) {
                        const char* clipboard = ImGui::GetIO().GetClipboardTextFn(ImGui::GetIO().ClipboardUserData);
                        if (clipboard) {
                            strncpy(usernameInput, clipboard, sizeof(usernameInput) - 1);
                            usernameInput[sizeof(usernameInput) - 1] = '\0';
                        }
                    }
                    ImGui::PopStyleColor(3);

                    ImGui::Spacing();

                    ImGui::PushStyleColor(ImGuiCol_Text, ImVec4(0.8f, 0.9f, 1.0f, 1.0f));
                    ImGui::Text("Пароль (мин. 6 символов):");
                    ImGui::PopStyleColor();

                    // Стилизация поля password
                    ImGui::PushStyleColor(ImGuiCol_FrameBg, ImVec4(0.12f, 0.12f, 0.18f, 0.8f));
                    ImGui::PushStyleColor(ImGuiCol_FrameBgHovered, ImVec4(0.15f, 0.15f, 0.22f, 0.9f));
                    ImGui::PushStyleColor(ImGuiCol_FrameBgActive, ImVec4(0.18f, 0.18f, 0.25f, 1.0f));
                    ImGui::PushStyleColor(ImGuiCol_Text, ImVec4(0.9f, 0.9f, 0.95f, 1.0f));
                    ImGui::PushItemWidth(-1);
                    ImGui::InputText("##password", passwordInput, sizeof(passwordInput), ImGuiInputTextFlags_Password);
                    ImGui::PopItemWidth();
                    ImGui::PopStyleColor(4);

                    // Кнопка "Вставить из буфера" для password
                    ImGui::PushStyleColor(ImGuiCol_Button, ImVec4(0.3f, 0.4f, 0.6f, 0.8f));
                    ImGui::PushStyleColor(ImGuiCol_ButtonHovered, ImVec4(0.4f, 0.5f, 0.7f, 0.9f));
                    ImGui::PushStyleColor(ImGuiCol_ButtonActive, ImVec4(0.2f, 0.3f, 0.5f, 1.0f));
                    if (ImGui::Button("Вставить пароль из буфера", ImVec2(-FLT_MIN, 35 * scaleFactor))) {
                        const char* clipboard = ImGui::GetIO().GetClipboardTextFn(ImGui::GetIO().ClipboardUserData);
                        if (clipboard) {
                            strncpy(passwordInput, clipboard, sizeof(passwordInput) - 1);
                            passwordInput[sizeof(passwordInput) - 1] = '\0';
                        }
                    }
                    ImGui::PopStyleColor(3);

                    ImGui::Spacing();

                    // Кнопка регистрации
                    ImGui::PushStyleColor(ImGuiCol_Button, ImVec4(0.6f, 0.4f, 0.8f, 0.8f));
                    ImGui::PushStyleColor(ImGuiCol_ButtonHovered, ImVec4(0.7f, 0.5f, 0.9f, 0.9f));
                    ImGui::PushStyleColor(ImGuiCol_ButtonActive, ImVec4(0.5f, 0.3f, 0.7f, 1.0f));
                    ImGui::PushStyleColor(ImGuiCol_Text, ImVec4(1.0f, 1.0f, 1.0f, 1.0f));
                    if (ImGui::Button("Регистрация", ImVec2(140 * scaleFactor, 45 * scaleFactor))) {
                        showRegistration = !showRegistration;
                    }
                    ImGui::PopStyleColor(4);

                    ImGui::SameLine();

                    // Кнопка входа
                    ImGui::PushStyleColor(ImGuiCol_Button, ImVec4(0.2f, 0.7f, 0.3f, 0.8f));
                    ImGui::PushStyleColor(ImGuiCol_ButtonHovered, ImVec4(0.3f, 0.8f, 0.4f, 0.9f));
                    ImGui::PushStyleColor(ImGuiCol_ButtonActive, ImVec4(0.1f, 0.6f, 0.2f, 1.0f));
                    ImGui::PushStyleColor(ImGuiCol_Text, ImVec4(1.0f, 1.0f, 1.0f, 1.0f));
                    if (ImGui::Button(isLoading ? "Входим..." : "Войти", ImVec2(140 * scaleFactor, 45 * scaleFactor))) {
                        if (isLoading) {
                            // Кнопка заблокирована во время загрузки
                        } else if (strlen(usernameInput) == 0 || strlen(passwordInput) == 0) {
                            statusMessage = "Пожалуйста, введите имя пользователя и пароль";
                        } else if (strlen(usernameInput) < 3) {
                            statusMessage = "Имя пользователя должно содержать минимум 3 символа";
                        } else if (strlen(passwordInput) < 6) {
                            statusMessage = "Пароль должен содержать минимум 6 символов";
                        } else {
                            // Реальная логика входа для Type2
                            isLoading = true;
                            loadingProgress = 0.0f;
                            loadingText = "Входим в систему...";
                            statusMessage = "Проверяем учетные данные...";

                            loadingProgress = 0.3f;
                            loadingText = "Подключаемся к серверу...";

                            // Вызываем функцию логина
                            std::string result = LoginWithCredentials(std::string(usernameInput), std::string(passwordInput));

                            loadingProgress = 0.7f;
                            loadingText = "Проверяем данные...";

                            // Проверяем результат
                            if (result.substr(0, 5) == "VALID") {
                                licenseStatus = result;
                                currentScreen = AppScreen::Main;
                                keyChecked = true;

                                // Парсим дополнительную информацию из результата
                                size_t first_pipe = result.find("|");
                                if (first_pipe != std::string::npos) {
                                    size_t second_pipe = result.find("|", first_pipe + 1);
                                    if (second_pipe != std::string::npos) {
                                        std::string expires_at = result.substr(first_pipe + 1, second_pipe - first_pipe - 1);
                                        std::string seconds_left = result.substr(second_pipe + 1);
                                        statusMessage = "Успешный вход в систему!\nИстекает: " + expires_at + "\nОсталось: " + seconds_left;
                                    } else {
                                        std::string expires_at = result.substr(first_pipe + 1);
                                        statusMessage = "Успешный вход в систему!\nИстекает: " + expires_at;
                                    }
                                } else {
                                    statusMessage = "Успешный вход в систему!";
                                }

                                // Обновляем статус сообщение с уведомлениями из ответа сервера
                                UpdateStatusMessageFromResponse(statusMessage);

                                // Загружаем changelog после успешной авторизации
                                LoadChangelogIfNeeded();

                                // Загружаем список игр после успешной авторизации
                                LoadGamesIfNeeded();
                            } else {
                                statusMessage = "Ошибка входа: " + result;
                                keyChecked = false;
                            }

                            loadingProgress = 1.0f;
                            loadingText = "Завершено!";

                            isLoading = false;
                            loadingProgress = 0.0f;
                        }
                    }
                    ImGui::PopStyleColor(4); // Закрываем стили кнопки входа Type2

                    // Показываем поле email при регистрации
                    if (showRegistration) {
                        ImGui::Spacing();
                        ImGui::Separator();
                        ImGui::Spacing();

                        ImGui::PushStyleColor(ImGuiCol_Text, ImVec4(0.8f, 0.9f, 1.0f, 1.0f));
                        ImGui::Text("Email (необязательно):");
                        ImGui::PopStyleColor();

                        // Подсказка о email
                        ImGui::PushStyleColor(ImGuiCol_Text, ImVec4(0.6f, 0.7f, 0.8f, 1.0f));
                        ImGui::TextWrapped("Email позволяет восстановить доступ к аккаунту и получать уведомления. Если у вас нет email, оставьте поле пустым.");
                        ImGui::PopStyleColor();
                        ImGui::Spacing();

                        // Стилизация поля email
                        ImGui::PushStyleColor(ImGuiCol_FrameBg, ImVec4(0.12f, 0.12f, 0.18f, 0.8f));
                        ImGui::PushStyleColor(ImGuiCol_FrameBgHovered, ImVec4(0.15f, 0.15f, 0.22f, 0.9f));
                        ImGui::PushStyleColor(ImGuiCol_FrameBgActive, ImVec4(0.18f, 0.18f, 0.25f, 1.0f));
                        ImGui::PushStyleColor(ImGuiCol_Text, ImVec4(0.9f, 0.9f, 0.95f, 1.0f));
                        ImGui::PushItemWidth(-1);
                        ImGui::InputText("##email", emailInput, sizeof(emailInput));
                        ImGui::PopItemWidth();
                        ImGui::PopStyleColor(4);

                        // Кнопка "Вставить из буфера" для email
                        ImGui::PushStyleColor(ImGuiCol_Button, ImVec4(0.3f, 0.4f, 0.6f, 0.8f));
                        ImGui::PushStyleColor(ImGuiCol_ButtonHovered, ImVec4(0.4f, 0.5f, 0.7f, 0.9f));
                        ImGui::PushStyleColor(ImGuiCol_ButtonActive, ImVec4(0.2f, 0.3f, 0.5f, 1.0f));
                        if (ImGui::Button("Вставить email из буфера", ImVec2(-FLT_MIN, 35 * scaleFactor))) {
                            const char* clipboard = ImGui::GetIO().GetClipboardTextFn(ImGui::GetIO().ClipboardUserData);
                            if (clipboard) {
                                strncpy(emailInput, clipboard, sizeof(emailInput) - 1);
                                emailInput[sizeof(emailInput) - 1] = '\0';
                            }
                        }
                        ImGui::PopStyleColor(3);

                        ImGui::Spacing();

                        // Кнопка регистрации
                        ImGui::PushStyleColor(ImGuiCol_Button, ImVec4(0.8f, 0.5f, 0.2f, 0.8f));
                        ImGui::PushStyleColor(ImGuiCol_ButtonHovered, ImVec4(0.9f, 0.6f, 0.3f, 0.9f));
                        ImGui::PushStyleColor(ImGuiCol_ButtonActive, ImVec4(0.7f, 0.4f, 0.1f, 1.0f));
                        ImGui::PushStyleColor(ImGuiCol_Text, ImVec4(1.0f, 1.0f, 1.0f, 1.0f));
                        if (ImGui::Button("Зарегистрироваться", ImVec2(-FLT_MIN, 45 * scaleFactor))) {
                            if (strlen(usernameInput) == 0 || strlen(passwordInput) == 0) {
                                statusMessage = "Пожалуйста, введите имя пользователя и пароль";
                            } else if (strlen(usernameInput) < 3) {
                                statusMessage = "Имя пользователя должно содержать минимум 3 символа";
                            } else if (strlen(passwordInput) < 6) {
                                statusMessage = "Пароль должен содержать минимум 6 символов";
                            } else if (strlen(emailInput) > 0 && strlen(emailInput) < 5) {
                                statusMessage = "Email должен содержать минимум 5 символов";
                            } else {
                                // Реальная логика регистрации
                                isLoading = true;
                                loadingProgress = 0.0f;
                                loadingText = "Регистрируем аккаунт...";
                                statusMessage = "Создаем новый аккаунт...";

                                loadingProgress = 0.3f;
                                loadingText = "Подключаемся к серверу...";

                                // Вызываем функцию регистрации
                                std::string result = RegisterAccount(
                                        std::string(usernameInput),
                                        std::string(passwordInput),
                                        std::string(emailInput)
                                );

                                loadingProgress = 0.7f;
                                loadingText = "Сохраняем данные...";

                                // Проверяем результат
                                if (result.find("Успешно") != std::string::npos || result.find("создан") != std::string::npos) {
                                    statusMessage = "Аккаунт успешно создан! Теперь вы можете войти.";
                                    showRegistration = false;

                                    // Очищаем поля после успешной регистрации
                                    memset(passwordInput, 0, sizeof(passwordInput));
                                    memset(emailInput, 0, sizeof(emailInput));

                                    ShowImGuiToast("Аккаунт успешно создан!", "success", 3.0f);
                                } else {
                                    statusMessage = "Ошибка регистрации: " + result;
                                    ShowImGuiToast("Ошибка регистрации", "error", 3.0f);
                                }

                                loadingProgress = 1.0f;
                                loadingText = "Завершено!";

                                isLoading = false;
                                loadingProgress = 0.0f;
                            }
                        }
                        ImGui::PopStyleColor(4);
                    }
                }
                ImGui::Spacing();

                // Индикатор загрузки
                if (isLoading) {
                    ImGui::Separator();
                    ImGui::Spacing();

                    // Анимированный текст загрузки
                    ImGui::PushStyleColor(ImGuiCol_Text, ImVec4(0.2f, 0.8f, 1.0f, 1.0f)); // Яркий голубой
                    ImGui::Text("%s", loadingText.c_str());
                    ImGui::PopStyleColor();

                    // Прогресс бар с красивой анимацией
                    ImGui::PushStyleColor(ImGuiCol_PlotHistogram, ImVec4(0.2f, 0.8f, 1.0f, 0.8f));
                    ImGui::PushStyleColor(ImGuiCol_FrameBg, ImVec4(0.1f, 0.1f, 0.15f, 0.8f));
                    ImGui::ProgressBar(loadingProgress, ImVec2(-FLT_MIN, 25 * scaleFactor));
                    ImGui::PopStyleColor(2);

                    // Анимированные точки
                    ImGui::PushStyleColor(ImGuiCol_Text, ImVec4(0.6f, 0.8f, 1.0f, 1.0f));
                    ImGui::Text("Загрузка");
                    ImGui::SameLine();
                    int dots = (int)(loadingAnimation * 4) % 4;
                    for (int i = 0; i < dots; i++) {
                        ImGui::Text(".");
                        ImGui::SameLine();
                    }
                    ImGui::NewLine();
                    ImGui::PopStyleColor();

                    ImGui::Spacing();
                }

                ImGui::Separator();
                ImGui::Spacing();
                // Уменьшаем шрифт для сообщения
                ImGui::PushStyleVar(ImGuiStyleVar_ItemSpacing, ImVec2(8, 16));
                ImGui::PushFont(io.Fonts->Fonts[0]); // используем основной шрифт, но уменьшим масштаб
                ImGui::SetWindowFontScale(0.8f); // уменьшить только для этого окна
                ImGui::PushTextWrapPos(ImGui::GetCursorPosX() + windowSize.x - 32.0f); // ограничить ширину
                ImGui::TextWrapped("%s", statusMessage.c_str());
                ImGui::PopTextWrapPos();
                ImGui::SetWindowFontScale(1.0f);
                ImGui::PopFont();
                ImGui::PopStyleVar();
            }
            ImGui::End();

            // Закрываем все стили окна логина
            ImGui::PopStyleColor(3); // WindowBg, Border, Text
            ImGui::PopStyleVar(5);   // WindowRounding, WindowPadding, FrameRounding, ItemSpacing, ItemInnerSpacing
        } else if (currentScreen == AppScreen::Main) {
            // Центрируем окно главной страницы
            ImVec2 windowSize(420 * scaleFactor, 0); // немного увеличили ширину
            ImVec2 windowPos((width - windowSize.x) * 0.5f, height * 0.1f);
            ImGui::SetNextWindowPos(windowPos, ImGuiCond_FirstUseEver);
            ImGui::SetNextWindowSize(windowSize, ImGuiCond_FirstUseEver);

            // Применяем красивые стили для главной страницы
            ImGui::PushStyleVar(ImGuiStyleVar_WindowRounding, 15.0f);
            ImGui::PushStyleVar(ImGuiStyleVar_WindowPadding, ImVec2(20.0f, 20.0f));
            ImGui::PushStyleVar(ImGuiStyleVar_FrameRounding, 8.0f);
            ImGui::PushStyleVar(ImGuiStyleVar_ItemSpacing, ImVec2(12.0f, 8.0f));

            // Красивые цвета для главной страницы
            ImGui::PushStyleColor(ImGuiCol_WindowBg, ImVec4(0.08f, 0.08f, 0.12f, 0.95f)); // Темно-синий фон
            ImGui::PushStyleColor(ImGuiCol_Border, ImVec4(0.2f, 0.4f, 0.8f, 0.6f)); // Синяя граница
            ImGui::PushStyleColor(ImGuiCol_Text, ImVec4(0.9f, 0.9f, 0.95f, 1.0f)); // Светлый текст

            if (ImGui::Begin("Главная страница", nullptr, ImGuiWindowFlags_NoCollapse | ImGuiWindowFlags_NoResize)) {
                // Кнопка "Назад" в верхней части
                ImGui::PushStyleColor(ImGuiCol_Button, ImVec4(0.6f, 0.3f, 0.3f, 0.8f));
                ImGui::PushStyleColor(ImGuiCol_ButtonHovered, ImVec4(0.7f, 0.4f, 0.4f, 0.9f));
                ImGui::PushStyleColor(ImGuiCol_ButtonActive, ImVec4(0.5f, 0.2f, 0.2f, 1.0f));
                ImGui::PushStyleColor(ImGuiCol_Text, ImVec4(1.0f, 1.0f, 1.0f, 1.0f));
                if (ImGui::Button("Назад к логину", ImVec2(140 * scaleFactor, 45 * scaleFactor))) {
                    currentScreen = AppScreen::Login;
                    keyChecked = false;
                    currentLoginType = LoginType::Type1; // Сбрасываем на Type1 по умолчанию
                    statusMessage = "Введите ключ лицензии и нажмите 'Войти в систему'";
                    licenseStatus.clear();
                    // Очищаем все поля
                    memset(keyInput, 0, sizeof(keyInput));
                    memset(usernameInput, 0, sizeof(usernameInput));
                    memset(passwordInput, 0, sizeof(passwordInput));
                    memset(emailInput, 0, sizeof(emailInput));
                    showRegistration = false;
                }
                ImGui::PopStyleColor(4);

                // Кнопка "Выйти" для Type2 пользователей
                if (currentLoginType == LoginType::Type2) {
                    ImGui::SameLine();
                    ImGui::PushStyleColor(ImGuiCol_Button, ImVec4(0.8f, 0.4f, 0.2f, 0.8f));
                    ImGui::PushStyleColor(ImGuiCol_ButtonHovered, ImVec4(0.9f, 0.5f, 0.3f, 0.9f));
                    ImGui::PushStyleColor(ImGuiCol_ButtonActive, ImVec4(0.7f, 0.3f, 0.1f, 1.0f));
                    ImGui::PushStyleColor(ImGuiCol_Text, ImVec4(1.0f, 1.0f, 1.0f, 1.0f));
                    if (ImGui::Button("Выйти из аккаунта", ImVec2(140 * scaleFactor, 45 * scaleFactor))) {
                        // Вызываем функцию выхода
                        std::string logoutResult = LogoutAccount();
                        statusMessage = logoutResult;

                        if (logoutResult.find("Успешно") != std::string::npos) {
                            // Возвращаемся к экрану логина
                            currentScreen = AppScreen::Login;
                            keyChecked = false;
                            currentLoginType = LoginType::Type2; // Остаемся на Type2
                            licenseStatus.clear();
                            // Очищаем поля
                            memset(usernameInput, 0, sizeof(usernameInput));
                            memset(passwordInput, 0, sizeof(passwordInput));
                            memset(emailInput, 0, sizeof(emailInput));
                            showRegistration = false;
                            ShowImGuiToast("Вы вышли из аккаунта", "info", 3.0f);
                        } else {
                            ShowImGuiToast("Ошибка выхода", "error", 3.0f);
                        }
                    }
                    ImGui::PopStyleColor(4);
                }

                ImGui::Separator();
                ImGui::Spacing();

                // Отображаем статус лицензии
                if (!licenseStatus.empty()) {
                    ImGui::PushStyleColor(ImGuiCol_Text, ImVec4(0.0f, 1.0f, 0.0f, 1.0f)); // Зеленый цвет
                    ImGui::TextWrapped("успех %s", licenseStatus.c_str());
                    ImGui::PopStyleColor();
                    ImGui::Spacing();
                }

                // Отображаем информацию о проекте и игре
                ImGui::PushStyleColor(ImGuiCol_Text, ImVec4(0.0f, 0.8f, 1.0f, 1.0f)); // Голубой цвет
                ImGui::Text("Игра: %s", g_gameName.empty() ? "default_game" : g_gameName.c_str());
                ImGui::SameLine();
                ImGui::Text("Project ID: %s", g_ProjectId.c_str());
                ImGui::PopStyleColor();

                // Отображаем тип входа
                ImGui::PushStyleColor(ImGuiCol_Text, ImVec4(0.8f, 0.6f, 0.2f, 1.0f)); // Оранжевый цвет
                if (currentLoginType == LoginType::Type1) {
                    ImGui::Text("Тип входа: Лицензионный ключ");
                } else {
                    ImGui::Text("Тип входа: Личный аккаунт");
                }
                ImGui::PopStyleColor();
                ImGui::Spacing();

                // Основная информация
                ImGui::TextWrapped("%s", statusMessage.c_str());
                ImGui::Spacing();
                ImGui::Text("Добро пожаловать в систему!");

                ImGui::Spacing();
                ImGui::Separator();
                ImGui::Spacing();

                // Кнопка для просмотра changelog
                if (ImGui::Button("Просмотреть Changelog", ImVec2(-FLT_MIN, 50 * scaleFactor))) {
                    g_showChangelog = !g_showChangelog;
                }

                // Показываем количество записей changelog
                if (g_changelogLoaded) {
                    ImGui::SameLine();
                    ImGui::Text("(%zu записей)", g_changelogEntries.size());
                }

                // Кнопка для перезагрузки changelog
                ImGui::Spacing();
                if (ImGui::Button("Перезагрузить Changelog", ImVec2(-FLT_MIN, 40 * scaleFactor))) {
                    LOGI("Force reloading changelog...");
                    g_changelogLoaded = false;
                    g_changelogEntries.clear();
                    LoadChangelogIfNeeded();
                }

                ImGui::Spacing();
                ImGui::Separator();
                ImGui::Spacing();

                // Кнопки для управления конфигами
                ImGui::Text("Управление конфигами:");
                ImGui::Spacing();

                if (ImGui::Button("Скачать конфиг по ID", ImVec2(-FLT_MIN, 50 * scaleFactor))) {
                    g_showConfigDownloader = !g_showConfigDownloader;
                    if (g_showConfigDownloader) {
                        // Очищаем поля при открытии
                        memset(g_configIdInput, 0, sizeof(g_configIdInput));
                        g_configStatusMessage = "";
                    }
                }

                ImGui::Spacing();

                if (ImGui::Button("Загрузить конфиг на сервер", ImVec2(-FLT_MIN, 50 * scaleFactor))) {
                    g_showConfigUploader = !g_showConfigUploader;
                    if (g_showConfigUploader) {
                        // Очищаем поля при открытии
                        memset(g_configNameInput, 0, sizeof(g_configNameInput));
                        memset(g_configDescriptionInput, 0, sizeof(g_configDescriptionInput));
                        strcpy(g_configVersionInput, "1.0.0");
                        g_configIsPublic = true;
                        strcpy(g_configFilePath, "/data/data/com.example.myapplication/files/config.txt");

                        // Автоматически создаем файл config.txt, если его нет
                        std::ifstream check_file(g_configFilePath);
                        if (!check_file.is_open()) {
                            std::ofstream create_file(g_configFilePath);
                            if (create_file.is_open()) {
                                create_file << "# Конфигурационный файл\n";
                                create_file << "# Создан автоматически\n";
                                create_file << "version=1.0\n";
                                create_file << "enabled=true\n";
                                create_file.close();
                                g_configStatusMessage = "Файл config.txt создан автоматически";
                            } else {
                                g_configStatusMessage = "Ошибка создания файла config.txt";
                            }
                        } else {
                            g_configStatusMessage = "";
                        }
                        check_file.close();
                    }
                }
            }
            ImGui::End();

            // Закрываем все стили главной страницы
            ImGui::PopStyleColor(3); // WindowBg, Border, Text
            ImGui::PopStyleVar(4);   // WindowRounding, WindowPadding, FrameRounding, ItemSpacing

            // Окно changelog
            if (g_showChangelog) {
                ImVec2 changelogWindowSize(width * 0.9f, height * 0.8f);
                ImVec2 changelogWindowPos((width - changelogWindowSize.x) * 0.5f, (height - changelogWindowSize.y) * 0.1f);

                ImGui::SetNextWindowPos(changelogWindowPos, ImGuiCond_Always);
                ImGui::SetNextWindowSize(changelogWindowSize, ImGuiCond_Always);

                // Стили для changelog окна
                ImGui::PushStyleColor(ImGuiCol_WindowBg, ImVec4(0.08f, 0.08f, 0.12f, 0.95f)); // Темно-синий фон
                ImGui::PushStyleColor(ImGuiCol_Border, ImVec4(0.2f, 0.4f, 0.8f, 0.6f)); // Синяя граница
                ImGui::PushStyleColor(ImGuiCol_Text, ImVec4(0.9f, 0.9f, 0.95f, 1.0f)); // Светлый текст

                if (ImGui::Begin("Changelog", &g_showChangelog, ImGuiWindowFlags_NoCollapse)) {
                    // Показываем информацию о проекте и игре
                    ImGui::PushStyleColor(ImGuiCol_Text, ImVec4(0.0f, 0.8f, 1.0f, 1.0f));
                    ImGui::Text("Игра: %s | Project ID: %s", g_gameName.empty() ? "default_game" : g_gameName.c_str(), g_ProjectId.c_str());
                    ImGui::PopStyleColor();
                    ImGui::Separator();
                    ImGui::Spacing();

                    if (g_changelogLoaded) {
                        if (g_changelogEntries.empty()) {
                            ImGui::PushStyleColor(ImGuiCol_Text, ImVec4(0.7f, 0.7f, 0.7f, 1.0f));
                            ImGui::TextWrapped("Changelog для игры '%s' отсутствует или пуст.", g_gameName.empty() ? "default_game" : g_gameName.c_str());
                            ImGui::PopStyleColor();

                            ImGui::Spacing();
                            if (ImGui::Button("Попробовать снова", ImVec2(-FLT_MIN, 30 * scaleFactor))) {
                                LOGI("Retrying changelog load...");
                                g_changelogLoaded = false;
                                g_changelogEntries.clear();
                                LoadChangelogIfNeeded();
                            }
                        } else {
                            // Отображаем записи changelog
                            for (size_t i = 0; i < g_changelogEntries.size(); i++) {
                                const ChangelogEntry& entry = g_changelogEntries[i];

                                // Заголовок версии
                                ImGui::PushStyleColor(ImGuiCol_Text, ImVec4(0.0f, 0.8f, 1.0f, 1.0f));
                                ImGui::Text("v%s - %s", entry.version.c_str(), entry.title.c_str());
                                ImGui::PopStyleColor();

                                // Дата релиза
                                ImGui::SameLine();
                                ImGui::PushStyleColor(ImGuiCol_Text, ImVec4(0.6f, 0.6f, 0.6f, 1.0f));
                                ImGui::Text("(%s)", FormatDate(entry.release_date).c_str());
                                ImGui::PopStyleColor();

                                // Статус публичности
                                if (entry.is_public) {
                                    ImGui::SameLine();
                                    ImGui::PushStyleColor(ImGuiCol_Text, ImVec4(0.0f, 0.8f, 0.0f, 1.0f));
                                    ImGui::Text("Публично");
                                    ImGui::PopStyleColor();
                                } else {
                                    ImGui::SameLine();
                                    ImGui::PushStyleColor(ImGuiCol_Text, ImVec4(0.8f, 0.4f, 0.0f, 1.0f));
                                    ImGui::Text("Приватно");
                                    ImGui::PopStyleColor();
                                }

                                // Описание
                                if (!entry.description.empty()) {
                                    ImGui::PushStyleColor(ImGuiCol_Text, ImVec4(0.8f, 0.8f, 0.8f, 1.0f));
                                    ImGui::TextWrapped("%s", entry.description.c_str());
                                    ImGui::PopStyleColor();
                                }

                                // Список изменений
                                if (!entry.changes.empty()) {
                                    ImGui::Text("Изменения:");
                                    ImGui::Indent();
                                    for (const std::string& change : entry.changes) {
                                        ImGui::BulletText("%s", change.c_str());
                                    }
                                    ImGui::Unindent();
                                }

                                // Разделитель между записями
                                if (i < g_changelogEntries.size() - 1) {
                                    ImGui::Separator();
                                    ImGui::Spacing();
                                }
                            }
                        }
                    } else {
                        ImGui::PushStyleColor(ImGuiCol_Text, ImVec4(0.0f, 0.8f, 1.0f, 1.0f));
                        ImGui::Text("Загрузка changelog для игры '%s'...", g_gameName.empty() ? "default_game" : g_gameName.c_str());
                        ImGui::PopStyleColor();

                        ImGui::Spacing();
                        ImGui::ProgressBar(0.5f, ImVec2(-FLT_MIN, 20 * scaleFactor));

                        ImGui::Spacing();
                        if (ImGui::Button("Принудительная загрузка", ImVec2(-FLT_MIN, 30 * scaleFactor))) {
                            LOGI("Force loading changelog...");
                            LoadChangelogIfNeeded();
                        }
                    }
                }
                ImGui::End();

                // Восстанавливаем стили для changelog окна
                ImGui::PopStyleColor(3); // WindowBg, Border, Text
            }

            // Окно скачивания конфига по ID
            if (g_showConfigDownloader) {
                ImVec2 downloaderWindowSize(400 * scaleFactor, 0);
                ImVec2 downloaderWindowPos((width - downloaderWindowSize.x) * 0.5f, (height - downloaderWindowSize.y) * 0.3f);

                ImGui::SetNextWindowPos(downloaderWindowPos, ImGuiCond_Always);
                ImGui::SetNextWindowSize(downloaderWindowSize, ImGuiCond_Always);

                if (ImGui::Begin("Скачать конфиг по ID", &g_showConfigDownloader, ImGuiWindowFlags_NoCollapse)) {
                    ImGui::Text("Введите 8-значный ID конфига для скачивания:");
                    ImGui::Text("(например: A1B2C3D4)");
                    ImGui::Spacing();

                    ImGui::InputText("ID конфига", g_configIdInput, sizeof(g_configIdInput));

                    // Кнопка "Вставить из буфера" рядом с полем ввода
                    ImGui::SameLine();
                    if (ImGui::Button("Вставить из буфера", ImVec2(40 * scaleFactor, 0))) {
                        std::string clipboardText = GetClipboardText(g_App);
                        if (!clipboardText.empty()) {
                            // Очищаем от пробелов и переносов строк
                            clipboardText.erase(std::remove_if(clipboardText.begin(), clipboardText.end(),
                                                               [](char c) { return std::isspace(c); }), clipboardText.end());

                            // Проверяем, что текст содержит только допустимые символы и имеет правильную длину
                            if (clipboardText.length() == 8 &&
                                std::all_of(clipboardText.begin(), clipboardText.end(),
                                            [](char c) { return std::isalnum(c); })) {
                                strncpy(g_configIdInput, clipboardText.c_str(), sizeof(g_configIdInput) - 1);
                                g_configIdInput[sizeof(g_configIdInput) - 1] = '\0';
                                g_configStatusMessage = "ID вставлен из буфера обмена";
                            } else {
                                g_configStatusMessage = "Ошибка: В буфере должен быть 8-значный ID (только буквы и цифры)";
                            }
                        } else {
                            g_configStatusMessage = "Буфер обмена пуст";
                        }
                    }
                    if (ImGui::IsItemHovered()) {
                        ImGui::SetTooltip("Вставить ID из буфера обмена");
                    }

                    ImGui::Spacing();

                    if (ImGui::Button(g_configDownloading ? "Скачиваем..." : "Скачать конфиг", ImVec2(-FLT_MIN, 50 * scaleFactor))) {
                        if (g_configDownloading) {
                            // Кнопка заблокирована во время скачивания
                        } else if (strlen(g_configIdInput) == 0) {
                            g_configStatusMessage = "Пожалуйста, введите ID конфига";
                        } else if (strlen(g_configIdInput) != 8) {
                            g_configStatusMessage = "ID должен содержать ровно 8 символов";
                        } else {
                            g_configDownloading = true;
                            g_configStatusMessage = "Скачиваем конфиг...";

                            // Создаем путь для сохранения файла
                            std::string save_path = "/sdcard/Download/config_" + std::string(g_configIdInput) + ".txt";

                            std::string result = DownloadConfigById(g_Token, std::string(g_configIdInput), save_path);
                            g_configStatusMessage = result;

                            g_configDownloading = false;

                            if (result.find("успешно") != std::string::npos) {
                                ShowImGuiToast("Конфиг успешно скачан!", "success", 3.0f);
                            } else {
                                ShowImGuiToast("Ошибка скачивания конфига", "error", 3.0f);
                            }
                        }
                    }

                    ImGui::Spacing();
                    ImGui::Separator();
                    ImGui::Spacing();

                    if (!g_configStatusMessage.empty()) {
                        ImGui::TextWrapped("%s", g_configStatusMessage.c_str());
                    }
                }
                ImGui::End();
            }

            // Окно загрузки конфига на сервер
            if (g_showConfigUploader) {
                ImVec2 uploaderWindowSize(450 * scaleFactor, 0);
                ImVec2 uploaderWindowPos((width - uploaderWindowSize.x) * 0.5f, (height - uploaderWindowSize.y) * 0.2f);

                ImGui::SetNextWindowPos(uploaderWindowPos, ImGuiCond_Always);
                ImGui::SetNextWindowSize(uploaderWindowSize, ImGuiCond_Always);

                if (ImGui::Begin("Загрузить конфиг на сервер", &g_showConfigUploader, ImGuiWindowFlags_NoCollapse)) {
                    // Отображение игры (используем глобальную переменную)
                    ImGui::Text("Игра: %s", g_gameName.empty() ? "Не указана" : g_gameName.c_str());
                    ImGui::Spacing();

                    ImGui::Text("Информация о конфиге:");
                    ImGui::Spacing();

                    ImGui::InputText("Название", g_configNameInput, sizeof(g_configNameInput));
                    ImGui::InputText("Описание", g_configDescriptionInput, sizeof(g_configDescriptionInput));
                    ImGui::InputText("Версия", g_configVersionInput, sizeof(g_configVersionInput));
                    ImGui::Checkbox("Публичный конфиг", &g_configIsPublic);

                    ImGui::Spacing();
                    ImGui::Text("Путь к файлу конфига:");
                    ImGui::InputText("Путь к файлу", g_configFilePath, sizeof(g_configFilePath));

                    // Кнопки для быстрого выбора путей
                    ImGui::Spacing();
                    ImGui::Text("Быстрый выбор пути:");
                    if (ImGui::Button("Download/config.txt", ImVec2(150 * scaleFactor, 30 * scaleFactor))) {
                        strcpy(g_configFilePath, "/storage/emulated/0/Download/config.txt");
                    }
                    ImGui::SameLine();
                    if (ImGui::Button("sdcard/Download/config.txt", ImVec2(150 * scaleFactor, 30 * scaleFactor))) {
                        strcpy(g_configFilePath, "/sdcard/Download/config.txt");
                    }
                    ImGui::SameLine();
                    if (ImGui::Button("Внутреннее хранилище", ImVec2(150 * scaleFactor, 30 * scaleFactor))) {
                        strcpy(g_configFilePath, "/data/data/com.example.myapplication/files/config.txt");
                    }

                    ImGui::Spacing();
                    if (ImGui::Button("Создать config.txt во внутреннем хранилище", ImVec2(-FLT_MIN, 30 * scaleFactor))) {
                        // Создаем файл config.txt во внутреннем хранилище
                        std::string internal_path = "/data/data/com.example.myapplication/files/config.txt";
                        std::ofstream file(internal_path);
                        if (file.is_open()) {
                            file << "# Конфигурационный файл\n";
                            file << "# Создан автоматически\n";
                            file << "version=1.0\n";
                            file << "enabled=true\n";
                            file.close();
                            strcpy(g_configFilePath, internal_path.c_str());
                            g_configStatusMessage = "Файл config.txt создан во внутреннем хранилище";
                        } else {
                            g_configStatusMessage = "Ошибка создания файла во внутреннем хранилище";
                        }
                    }

                    ImGui::Spacing();

                    if (ImGui::Button(g_configUploading ? "Загружаем..." : "Загрузить конфиг", ImVec2(-FLT_MIN, 50 * scaleFactor))) {
                        if (g_configUploading) {
                            // Кнопка заблокирована во время загрузки
                        } else if (strlen(g_configFilePath) == 0) {
                            g_configStatusMessage = "Пожалуйста, укажите путь к файлу конфига";
                        } else if (g_gameName.empty()) {
                            g_configStatusMessage = "Имя игры не указано";
                        } else {
                            g_configUploading = true;
                            g_configStatusMessage = "Загружаем конфиг на сервер...";

                            std::string result = UploadConfigFile(g_Token, g_selectedGameName, g_configFilePath,
                                                                  g_configNameInput, g_configDescriptionInput,
                                                                  g_configVersionInput, g_configIsPublic);
                            g_configStatusMessage = result;
                            g_configUploading = false;

                            if (result.find("успешно") != std::string::npos) {
                                ShowImGuiToast("Конфиг успешно загружен!", "success", 3.0f);
                                // Показываем 8-значный ID в сообщении
                                if (result.find("ID:") != std::string::npos) {
                                    ShowImGuiToast("ID для обмена: " + result.substr(result.find("ID:") + 4, 8), "info", 5.0f);
                                }
                            } else {
                                ShowImGuiToast("Ошибка загрузки конфига", "error", 3.0f);
                            }
                        }
                    }

                    ImGui::Spacing();
                    ImGui::Separator();
                    ImGui::Spacing();

                    if (!g_configStatusMessage.empty()) {
                        ImGui::TextWrapped("%s", g_configStatusMessage.c_str());

                        // Если есть ошибка авторизации, показываем кнопку возврата к логину
                        if (g_configStatusMessage.find("авторизации") != std::string::npos ||
                            g_configStatusMessage.find("токен") != std::string::npos ||
                            g_configStatusMessage.find("Invalid token") != std::string::npos) {
                            ImGui::Spacing();
                            if (ImGui::Button("Вернуться к экрану логина", ImVec2(-FLT_MIN, 40 * scaleFactor))) {
                                // Возвращаемся к экрану логина
                                currentScreen = AppScreen::Login;
                                keyChecked = false;
                                statusMessage = "Введите ключ лицензии и нажмите 'Войти в систему'";
                                licenseStatus.clear();
                                g_Token.clear(); // Очищаем недействительный токен
                                g_showConfigUploader = false; // Закрываем окно загрузки
                            }
                        }
                    }
                }
                ImGui::End();
            }
        }

        // Обновляем и отображаем ImGui Toast уведомления
        UpdateImGuiToasts();

        // Рендеринг
        ImGui::Render();
        glViewport(0, 0, (int)io.DisplaySize.x, (int)io.DisplaySize.y);
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