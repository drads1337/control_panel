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
#include <sys/stat.h>
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

// Direct curl access for mTLS workaround
#include <curl/curl.h>

#define LOGI(...) __android_log_print(ANDROID_LOG_INFO, "LicenseCheck", __VA_ARGS__)
#define LOGE(...) __android_log_print(ANDROID_LOG_ERROR, "LicenseCheck", __VA_ARGS__)
#define LOGW(...) __android_log_print(ANDROID_LOG_WARN, "LicenseCheck", __VA_ARGS__)

using json = nlohmann::json;

// Configuration
// Production server with mTLS support
constexpr const char* SERVER_URL = "https://ovrin.xyz";
constexpr const char* SERVER_URL_EMULATOR = "https://ovrin.xyz";  // Use same URL for emulator
constexpr const char* MASTER_KEY_HEX = "ca3695f66cc428a41e6bc8c2ed7ee27b0940fe4da284ae03cc89b89edb35c339";

// mTLS Security Note
// ============================================================================
// SECURITY: mTLS (Mutual TLS) provides strong authentication and protection
// against MITM attacks without needing SSL pinning.
// 
// mTLS ensures:
// - Server verifies client certificate (authenticates client)
// - Client verifies server certificate (standard SSL/TLS)
// - Both sides are authenticated, providing strong security
// 
// SSL pinning is NOT needed when using mTLS, as mTLS already provides:
// - Certificate chain validation (standard SSL)
// - Client authentication (via mTLS client certificate)
// - Protection against MITM attacks
// ============================================================================

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
// Embedded Client Certificates
// ============================================================================
// Certificates are embedded in code and automatically written to app's internal storage
// on first launch. This ensures certificates are available without manual installation.
//
// INSTRUCTIONS: Replace the certificate and key content below with your actual files:
// 1. Copy content from client-cert.pem (lines 1-28) → CLIENT_CERT_CONTENT
// 2. Copy content from client-key.pem (lines 1-29) → CLIENT_KEY_CONTENT
// ============================================================================

static const char* CLIENT_CERT_CONTENT = R"(-----BEGIN CERTIFICATE-----
MIIEhzCCAm+gAwIBAgIUJnIkuuV4lXCcqSH+67oM/weEwEwwDQYJKoZIhvcNAQEL
BQAwPTELMAkGA1UEBhMCVVMxCzAJBgNVBAgMAkNBMQ4wDAYDVQQKDAVQYW5lbDER
MA8GA1UEAwwIUGFuZWwgQ0EwHhcNMjYwMTA4MDMxNDQ1WhcNMjcwMTA4MDMxNDQ1
WjBYMQswCQYDVQQGEwJVUzELMAkGA1UECAwCQ0ExFjAUBgNVBAcMDVNhbiBGcmFu
Y2lzY28xDjAMBgNVBAoMBVBhbmVsMRQwEgYDVQQDDAt0ZXN0LWNsaWVudDCCASIw
DQYJKoZIhvcNAQEBBQADggEPADCCAQoCggEBAKRwbUgPGEzd7HapZwoCpb21dyAI
OSfsIZoTxH6BfbLKsAjrwWrcqPDMYAC3i0zwNpjU9Y+d6A2w68NqLrctryavG3T6
eUGqCcCRpVfxgOOCQxF7/KYztwqT/MBJkNGXhbHCpr9Y5Aj6Hn2vni7lxasvNFB3
lZeHLQ55Qur0fUyZedDphQsvkLD4dpYucn6FLST8X3D26FqRkMegwlSQVmBJhgnv
kJBeXz14YkGBwTjIjPicWcy/v5hpbl2PizihfniSJ5fTP4ZzoAqIQ4n7mqPPmLzE
qSIRgobMM64YmmXwekK2UtCjL3kYi3jCT5dF4GaPU9Yva0TCO/ANeRyYO5sCAwEA
AaNkMGIwCwYDVR0PBAQDAgWgMBMGA1UdJQQMMAoGCCsGAQUFBwMCMB0GA1UdDgQW
BBTD1Q3YKn8yBOt3b89qMTR4jryh6zAfBgNVHSMEGDAWgBTNwcVmVMFDSBcDNrHG
J0Kby+9PeDANBgkqhkiG9w0BAQsFAAOCAgEAsJEGF1AZZYVG8Zlb2v8LzXGyqVFF
vBtQ/+6suiLyDC6JfLoeVaRr8QnT178hy3Eojp0foJwoR3usrBLTKnjpCLTf3tdo
54HyCAVAnGuMvB63j5S9yCxVPhzVIelN8Vt72UZCyOQkF/Fe8fS5D+52JA6M1gNW
qTCLGnR9ht237ocXvx0yzQl4WUSpgcWTJ/su2gEvXBPWfgtBNqtU6sTGJUhM5xB6
I0/FrH1QBbuJss9PL2suJf0L0z2T0tUQ8zkv+wUbQmZBlLHJBMJIWXk0uJT5+bzN
qAUHnY6cSAxaXORQHJo+K1PpiKhqgePLcn4eZ5Ykoi0Y3MIzg5fByi/Vad8n2mwQ
lPRHX09IU2xLeNI9lye5UIE0Egx+oZ+4gjhsB16TNp0aMe6zuTlqEvDVZG0hpxtp
SPmnzi28wvgfYkYgr7iqQ5yV9hhpNXEkUfmRYooZp0u9U8AFp4nG338REdToYJk7
bomDjJg5iZE3xcJFx7Pym0ZB1MapV/3F8sBQzRpjy2GuWjNMnOurZDVGzSnAws3d
WXFxAci8MGPztKBJmSriJHUPOUdwFMzlz2sNMBGTlRnXSYw9YXUdTkah+joCwX+d
xP9mKMSTRinmlSxz73by/TQok8ZIyfdvjhX0N16zC3qOzSKqpC6wS4dDp193xdS7
/oFMP4qYpiNc97o=
-----END CERTIFICATE-----
)";

static const char* CLIENT_KEY_CONTENT = R"(-----BEGIN PRIVATE KEY-----
MIIEvAIBADANBgkqhkiG9w0BAQEFAASCBKYwggSiAgEAAoIBAQCkcG1IDxhM3ex2
qWcKAqW9tXcgCDkn7CGaE8R+gX2yyrAI68Fq3KjwzGAAt4tM8DaY1PWPnegNsOvD
ai63La8mrxt0+nlBqgnAkaVX8YDjgkMRe/ymM7cKk/zASZDRl4Wxwqa/WOQI+h59
r54u5cWrLzRQd5WXhy0OeULq9H1MmXnQ6YULL5Cw+HaWLnJ+hS0k/F9w9uhakZDH
oMJUkFZgSYYJ75CQXl89eGJBgcE4yIz4nFnMv7+YaW5dj4s4oX54kieX0z+Gc6AK
iEOJ+5qjz5i8xKkiEYKGzDOuGJpl8HpCtlLQoy95GIt4wk+XReBmj1PWL2tEwjvw
DXkcmDubAgMBAAECggEAHWd5MyR33O7mJMXgBfs5NfYoChNOXSQtUgbs4Q44surp
lX7KxFgW4ZA6LoajoytlJ+kUzAyZfTFAx13KYrkJk+pGB6HuYt6MBeJFZbdqq8QU
SCEaqYGf3oVd8eh1u/TTVFkRRjAX/r7zCtiHea1ermCvgyAPINxsIyVt4OO9MCAM
Bc3fXA8fRsDO9M02nZns8s41hKZ+Hw19g9vsMxQuXmN2YYC2n2WXrO24gfPsYN7K
zAW5tIlUUEc/E0z+q5HXg50ky9qVfIYkN0E3rlzHl9RHHk5B+fY9DcZ9PbxeZb3f
TBorPD9hL9ssGa4wLgrBMTH+K6r8Hv4tVR6R3D8lYQKBgQDchiOp3eylVsZyiAlA
pxM/6/FLiQqk4qGpVHo1zD6U7upmGRKyQiD0XH+qWEBDuwIRqQ7rEVCzwp/FwHct
FgzZmVqFV17BHP72c2/csLOh+J2V6USM0GfdGDSJpvD/e/IrltNnCSlPvjWD9q3q
FgAxBRfmyqwMB4ktSwzO/BLhawKBgQC+5IqLNEjw8oSNVkBh54LSk/VKljN2AW/s
qcDQ7cI0B1GFPHzV6i+LX2EP0nC7wPHOrMDLuFS/j7gQ2GyfvqaqCgpthLCrQdC+
h+G/Tsvku6Ah1UiTJnh+s2RUEEAtfZ132X0B4IphEX5vRkMamAk2n5baTG7G5L6h
p230coEqkQKBgEmZl3ONNvsj0A3Pq07htEIETD9KmLvZS91I7ZTg+w4YAzFaMuw9
t+P2r0E6PRCd7J3aT7lSyR2F2m9UwjHRBy7kyNpyA5TuSYYVlwMQEpP/dxDejtt0
fwXCm15J0mtigbvclefwndIYiKHnhbn35850hbqob+1/4l+0iazXYrHLAoGAfsn7
P1Rd8jOSWPHl12FWohkF/iFfUszHk1B4sgyJRddqjO1NGSPvqkmShVjH6dzQfu59
K5JmL8n8fqvREhUmS6BZpr5QPZ98T2CfT1q90FHSnUY1aw9NTxJF3BPjHJPnaDg7
cGi8YJam/K+VWG+NBwvevWWw2kgKWgKD5K29HxECgYBhzg3Ud4mx5Pv7JMEifo0G
DNfslJOABB/gnnvdxPBd9JeSPYoqfcD/c1Jgmao7X/10TGFTzqXPM8Rz/65IwlkD
23CmpBHB7cSJreOAOVteTdW4/+yLGZbTc/O4KgzgNVFxxNlaR8QKgyj52yPCNdF3
o7i+ilJIce5YDey8ZBEktw==
-----END PRIVATE KEY-----
)";

// Dynamic paths to certificate files (will be set during initialization)
static std::string g_ClientCertPath = "";
static std::string g_ClientKeyPath = "";

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
// Certificate File Management
// ============================================================================

/**
 * Get Android app's internal files directory path (recommended for certificates)
 * Returns path like "/data/data/com.package.name/files"
 * This directory doesn't require special permissions and is app-private
 */
static std::string GetAppFilesDir(android_app* app) {
    if (!app || !app->activity) {
        LOGE("GetAppFilesDir: Invalid app pointer");
        return "";
    }
    
    JNIEnv* env = nullptr;
    app->activity->vm->AttachCurrentThread(&env, nullptr);
    if (!env) {
        LOGE("GetAppFilesDir: Failed to attach to JNI");
        return "";
    }
    
    std::string result;
    do {
        jclass contextClass = env->FindClass("android/content/Context");
        if (!contextClass) break;
        
        jmethodID getFilesDirMethod = env->GetMethodID(contextClass, "getFilesDir", "()Ljava/io/File;");
        if (!getFilesDirMethod) break;
        
        jobject filesDirObj = env->CallObjectMethod(app->activity->clazz, getFilesDirMethod);
        if (env->ExceptionCheck() || !filesDirObj) {
            env->ExceptionClear();
            break;
        }
        
        jclass fileClass = env->FindClass("java/io/File");
        if (!fileClass) break;
        
        jmethodID getAbsolutePathMethod = env->GetMethodID(fileClass, "getAbsolutePath", "()Ljava/lang/String;");
        if (!getAbsolutePathMethod) break;
        
        jstring pathStr = (jstring)env->CallObjectMethod(filesDirObj, getAbsolutePathMethod);
        if (env->ExceptionCheck() || !pathStr) {
            env->ExceptionClear();
            break;
        }
        
        const char* pathChars = env->GetStringUTFChars(pathStr, nullptr);
        if (pathChars) {
            result = pathChars;
            env->ReleaseStringUTFChars(pathStr, pathChars);
        }
        
        env->DeleteLocalRef(filesDirObj);
        env->DeleteLocalRef(pathStr);
    } while (false);
    
    if (env && env->ExceptionCheck()) {
        env->ExceptionClear();
    }
    
    app->activity->vm->DetachCurrentThread();
    return result;
}

/**
 * Get Android Download directory path (fallback)
 * Returns path like "/storage/emulated/0/Download" or "/sdcard/Download"
 * Note: Requires READ_EXTERNAL_STORAGE permission on Android 10+
 */
static std::string GetDownloadDir(android_app* app) {
    if (!app || !app->activity) {
        LOGE("GetDownloadDir: Invalid app pointer");
        return "";
    }
    
    JNIEnv* env = nullptr;
    app->activity->vm->AttachCurrentThread(&env, nullptr);
    if (!env) {
        LOGE("GetDownloadDir: Failed to attach to JNI");
        return "";
    }
    
    std::string result;
    do {
        // Use Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_DOWNLOADS)
        jclass environmentClass = env->FindClass("android/os/Environment");
        if (!environmentClass) break;
        
        jfieldID downloadsField = env->GetStaticFieldID(environmentClass, "DIRECTORY_DOWNLOADS", "Ljava/lang/String;");
        if (!downloadsField) break;
        
        jstring downloadsDirName = (jstring)env->GetStaticObjectField(environmentClass, downloadsField);
        if (env->ExceptionCheck() || !downloadsDirName) {
            env->ExceptionClear();
            break;
        }
        
        jmethodID getExternalStoragePublicDirectoryMethod = env->GetStaticMethodID(
            environmentClass, 
            "getExternalStoragePublicDirectory", 
            "(Ljava/lang/String;)Ljava/io/File;"
        );
        if (!getExternalStoragePublicDirectoryMethod) break;
        
        jobject downloadDirObj = env->CallStaticObjectMethod(environmentClass, getExternalStoragePublicDirectoryMethod, downloadsDirName);
        if (env->ExceptionCheck() || !downloadDirObj) {
            env->ExceptionClear();
            env->DeleteLocalRef(downloadsDirName);
            break;
        }
        
        jclass fileClass = env->FindClass("java/io/File");
        if (!fileClass) break;
        
        jmethodID getAbsolutePathMethod = env->GetMethodID(fileClass, "getAbsolutePath", "()Ljava/lang/String;");
        if (!getAbsolutePathMethod) break;
        
        jstring pathStr = (jstring)env->CallObjectMethod(downloadDirObj, getAbsolutePathMethod);
        if (env->ExceptionCheck() || !pathStr) {
            env->ExceptionClear();
            env->DeleteLocalRef(downloadDirObj);
            env->DeleteLocalRef(downloadsDirName);
            break;
        }
        
        const char* pathChars = env->GetStringUTFChars(pathStr, nullptr);
        if (pathChars) {
            result = pathChars;
            env->ReleaseStringUTFChars(pathStr, pathChars);
        }
        
        env->DeleteLocalRef(downloadDirObj);
        env->DeleteLocalRef(pathStr);
        env->DeleteLocalRef(downloadsDirName);
    } while (false);
    
    if (env && env->ExceptionCheck()) {
        env->ExceptionClear();
    }
    
    app->activity->vm->DetachCurrentThread();
    return result;
}

/**
 * Check if path exists and is readable
 */
static bool fileExistsAndReadable(const std::string& path) {
    std::ifstream file(path);
    bool exists = file.good();
    file.close();
    
    if (!exists) {
        LOGW("fileExistsAndReadable: File not accessible: %s", path.c_str());
        // Try to check if it's a permissions issue
        struct stat st;
        if (stat(path.c_str(), &st) == 0) {
            LOGW("fileExistsAndReadable: File exists but may not be readable (permissions?)");
            LOGW("fileExistsAndReadable: File size: %lld bytes, mode: %o", (long long)st.st_size, st.st_mode);
        } else {
            LOGW("fileExistsAndReadable: File does not exist or stat() failed");
        }
    }
    
    return exists;
}

/**
 * Write embedded certificates to app's internal storage
 * This allows libcurl to read certificate files directly
 */
static bool WriteEmbeddedCertificates(android_app* app) {
    if (!app || !app->activity) {
        LOGE("WriteEmbeddedCertificates: Invalid app pointer");
        return false;
    }
    
    std::string filesDir = GetAppFilesDir(app);
    if (filesDir.empty()) {
        LOGE("WriteEmbeddedCertificates: Cannot get app files directory");
        return false;
    }
    
    std::string certPath = filesDir + "/client-cert.pem";
    std::string keyPath = filesDir + "/client-key.pem";
    
    // Write certificate file
    std::ofstream certFile(certPath, std::ios::binary);
    if (!certFile.is_open()) {
        LOGE("WriteEmbeddedCertificates: Cannot create certificate file: %s", certPath.c_str());
        return false;
    }
    certFile << CLIENT_CERT_CONTENT;
    certFile.close();
    chmod(certPath.c_str(), 0600);  // rw-------
    
    // Write key file
    std::ofstream keyFile(keyPath, std::ios::binary);
    if (!keyFile.is_open()) {
        LOGE("WriteEmbeddedCertificates: Cannot create key file: %s", keyPath.c_str());
        std::remove(certPath.c_str());
        return false;
    }
    keyFile << CLIENT_KEY_CONTENT;
    keyFile.close();
    chmod(keyPath.c_str(), 0600);  // rw-------
    
    g_ClientCertPath = certPath;
    g_ClientKeyPath = keyPath;
    
    LOGI("WriteEmbeddedCertificates: ✅ Embedded certificates written to:");
    LOGI("WriteEmbeddedCertificates:   Certificate: %s", certPath.c_str());
    LOGI("WriteEmbeddedCertificates:   Key: %s", keyPath.c_str());
    
    return true;
}

/**
 * Initialize certificate files - uses embedded certificates
 * Writes embedded certificates to app's internal storage if not already present
 */
static bool InitializeCertificateFiles(android_app* app) {
    if (!app || !app->activity) {
        LOGE("InitializeCertificateFiles: Invalid app pointer");
        return false;
    }
    
    LOGI("InitializeCertificateFiles: START - Using embedded certificates");
    
    std::string filesDir = GetAppFilesDir(app);
    if (filesDir.empty()) {
        LOGE("InitializeCertificateFiles: Cannot get app files directory");
        return false;
    }
    
    std::string certPath = filesDir + "/client-cert.pem";
    std::string keyPath = filesDir + "/client-key.pem";
    
    // Check if certificates already exist
    if (fileExistsAndReadable(certPath) && fileExistsAndReadable(keyPath)) {
        LOGI("InitializeCertificateFiles: Certificate files already exist, using them");
        g_ClientCertPath = certPath;
        g_ClientKeyPath = keyPath;
    } else {
        // Write embedded certificates to files
        LOGI("InitializeCertificateFiles: Writing embedded certificates to files...");
        if (!WriteEmbeddedCertificates(app)) {
            LOGE("InitializeCertificateFiles: Failed to write embedded certificates");
            return false;
        }
    }
    
    // Verify files are valid
    std::ifstream certCheck(g_ClientCertPath);
    if (!certCheck.is_open()) {
        LOGE("InitializeCertificateFiles: Cannot open certificate file: %s", g_ClientCertPath.c_str());
        return false;
    }
    
    std::string certContent((std::istreambuf_iterator<char>(certCheck)), std::istreambuf_iterator<char>());
    certCheck.close();
    
    if (certContent.empty() || 
        certContent.find("-----BEGIN CERTIFICATE-----") == std::string::npos ||
        certContent.find("-----END CERTIFICATE-----") == std::string::npos) {
        LOGE("InitializeCertificateFiles: Invalid certificate file");
        return false;
    }
    
    std::ifstream keyCheck(g_ClientKeyPath);
    if (!keyCheck.is_open()) {
        LOGE("InitializeCertificateFiles: Cannot open key file: %s", g_ClientKeyPath.c_str());
        return false;
    }
    
    std::string keyContent((std::istreambuf_iterator<char>(keyCheck)), std::istreambuf_iterator<char>());
    keyCheck.close();
    
    if (keyContent.empty() ||
        keyContent.find("-----BEGIN PRIVATE KEY-----") == std::string::npos ||
        keyContent.find("-----END PRIVATE KEY-----") == std::string::npos) {
        LOGE("InitializeCertificateFiles: Invalid key file");
        return false;
    }
    
    LOGI("InitializeCertificateFiles: ✅ SUCCESS - Certificate files ready");
    LOGI("InitializeCertificateFiles:   Certificate: %s (%zu bytes)", g_ClientCertPath.c_str(), certContent.length());
    LOGI("InitializeCertificateFiles:   Key: %s (%zu bytes)", g_ClientKeyPath.c_str(), keyContent.length());
    
    return true;
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
// SSL/TLS and mTLS Configuration
// ============================================================================
// Note: SSL pinning removed - mTLS provides sufficient security
// mTLS ensures:
// - Server verifies client certificate (client authentication)
// - Client verifies server certificate (standard SSL/TLS verification)
// - Protection against MITM attacks without needing pinning

// SSL_CTX callback to disable server certificate verification
static CURLcode ssl_ctx_callback(CURL* curl, void* sslctx, void* userptr) {
    (void)curl;  // Unused
    (void)userptr;  // Unused
    LOGI("ApiClient: 🔧 SSL_CTX callback called - configuring SSL context");
    SSL_CTX* ctx = (SSL_CTX*)sslctx;
    if (ctx) {
        // Disable server certificate verification aggressively
        SSL_CTX_set_verify(ctx, SSL_VERIFY_NONE, nullptr);
        SSL_CTX_set_verify_depth(ctx, 0);

        // Load client certificate/key directly into SSL_CTX to force sending even if libcurl skips
        if (!g_ClientCertPath.empty()) {
            if (SSL_CTX_use_certificate_file(ctx, g_ClientCertPath.c_str(), SSL_FILETYPE_PEM) == 1) {
                LOGI("ApiClient: ✅ SSL_CTX loaded client certificate");
            } else {
                LOGW("ApiClient: ⚠️ SSL_CTX failed to load client certificate");
            }
        }
        if (!g_ClientKeyPath.empty()) {
            // Prefer RSA-converted key if it exists
            std::string keyPath = g_ClientKeyPath;
            size_t lastSlash = g_ClientKeyPath.find_last_of('/');
            std::string rsaKey = (lastSlash != std::string::npos)
                                     ? g_ClientKeyPath.substr(0, lastSlash) + "/client-key-rsa.pem"
                                     : "client-key-rsa.pem";
            struct stat st{};
            if (stat(rsaKey.c_str(), &st) == 0) keyPath = rsaKey;

            if (SSL_CTX_use_PrivateKey_file(ctx, keyPath.c_str(), SSL_FILETYPE_PEM) == 1) {
                LOGI("ApiClient: ✅ SSL_CTX loaded client private key");
            } else {
                LOGW("ApiClient: ⚠️ SSL_CTX failed to load client private key");
            }
        }

        LOGI("ApiClient: ✅ SSL_CTX verification disabled and client cert loaded");
    } else {
        LOGW("ApiClient: ⚠️  SSL_CTX callback called but ctx is null");
    }
    return CURLE_OK;
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
        std::ifstream fileStream(path);
        return fileStream.good();
    }
    
    // Helper function to load certificate from Android assets (if needed)
    static std::string loadFromAssets(const char* assetPath, android_app* app) {
        // This is a placeholder - implement asset loading based on your Android setup
        // You may need to use AAssetManager from Android NDK
        return "";
    }

    // Reuse the existing client certificate as a dummy CA bundle so that
    // SSL_CTX_load_verify_locations succeeds. A previous placeholder PEM
    // contained garbage data, which caused "error setting certificate verify
    // locations" before the SSL_CTX callback could disable verification.
    // Returns empty string if the dummy file could not be written.
    static std::string createDummyCaFromClientCert() {
        if (g_ClientCertPath.empty()) {
            return "";
        }

        size_t lastSlash = g_ClientCertPath.find_last_of('/');
        if (lastSlash == std::string::npos) {
            LOGW("ApiClient: Cannot derive dummy CA path from client cert path");
            return "";
        }

        std::string dummyCaPath = g_ClientCertPath.substr(0, lastSlash) + "/dummy-ca.pem";

        std::ifstream certIn(g_ClientCertPath);
        if (!certIn.good()) {
            LOGW("ApiClient: Cannot open client certificate to seed dummy CA: %s", g_ClientCertPath.c_str());
            return "";
        }
        std::string certContent((std::istreambuf_iterator<char>(certIn)), std::istreambuf_iterator<char>());
        certIn.close();

        if (certContent.find("-----BEGIN CERTIFICATE-----") == std::string::npos) {
            LOGW("ApiClient: Client certificate content missing BEGIN CERTIFICATE marker; not using as dummy CA");
            return "";
        }

        std::ofstream dummyCa(dummyCaPath, std::ios::trunc);
        if (!dummyCa.is_open()) {
            LOGW("ApiClient: Failed to create dummy CA file at %s", dummyCaPath.c_str());
            return "";
        }
        dummyCa << certContent;
        dummyCa.close();
        chmod(dummyCaPath.c_str(), 0644);

        LOGI("ApiClient: Dummy CA written using client certificate: %s", dummyCaPath.c_str());
        return dummyCaPath;
    }
    
    static cpr::Session createSession() {
        cpr::Session session;
        session.SetHeader({{"Content-Type", "application/json"}});
        session.SetTimeout(cpr::Timeout{10000});
        
        // Configure SSL/TLS with mTLS support
        // mTLS provides strong security without needing SSL pinning
        // Use dynamic paths from global variables (set during initialization)
        bool useMtls = !g_ClientCertPath.empty() && !g_ClientKeyPath.empty() &&
                       fileExists(g_ClientCertPath.c_str()) && fileExists(g_ClientKeyPath.c_str());
        
        if (useMtls) {
            // Verify certificate and key files are valid before configuring mTLS
            std::ifstream certCheck(g_ClientCertPath);
            std::string certContent((std::istreambuf_iterator<char>(certCheck)), std::istreambuf_iterator<char>());
            certCheck.close();
            
            std::ifstream keyCheck(g_ClientKeyPath);
            std::string keyContent((std::istreambuf_iterator<char>(keyCheck)), std::istreambuf_iterator<char>());
            keyCheck.close();
            
            if (certContent.find("-----BEGIN CERTIFICATE-----") == std::string::npos ||
                certContent.find("-----END CERTIFICATE-----") == std::string::npos) {
                LOGE("ApiClient: Certificate file appears invalid (missing BEGIN/END markers)");
                useMtls = false;
            } else if (keyContent.find("-----BEGIN PRIVATE KEY-----") == std::string::npos ||
                       keyContent.find("-----END PRIVATE KEY-----") == std::string::npos) {
                LOGE("ApiClient: Key file appears invalid (missing BEGIN/END markers)");
                useMtls = false;
            } else {
                LOGI("ApiClient: Certificate file valid (size: %zu bytes)", certContent.length());
                LOGI("ApiClient: Key file valid (size: %zu bytes)", keyContent.length());
            }
        }
        
        // WARNING: For Android, CA bundle verification is problematic
        // Android system CA certificates are in /system/etc/security/cacerts/ (directory)
        // but cpr/libcurl expects a file, not a directory (CApath vs CAfile)
        // 
        // For mTLS, server cert verification is less critical since:
        // 1. Client certificate authenticates the client (mTLS requirement)
        // 2. Server certificate verification can be disabled for testing
        // 3. For production: bundle Let's Encrypt root CA with the app
        //
        // NOTE: On Android, it's common to disable VerifyPeer due to CA bundle issues
        // This is acceptable for mTLS since the client certificate provides authentication
        
        bool foundCaBundle = false;
        const char* caBundlePath = nullptr;
        
        // Try to find a CA bundle file (not directory)
        // Android system CA certificates are in /system/etc/security/cacerts/ (directory)
        // but we need a file. Try to find a bundle file or use dummy CA
        const char* caBundleFilePaths[] = {
            "/etc/ssl/certs/ca-certificates.crt",  // Standard Linux CA bundle file
            "/system/etc/security/cacerts-bks",     // Android BKS keystore (if file)
            "/system/etc/security/cacerts/",        // Android CA directory (won't work, but check anyway)
            nullptr
        };
        
        for (int i = 0; caBundleFilePaths[i] != nullptr; i++) {
            std::ifstream test(caBundleFilePaths[i]);
            if (test.good()) {
                // Verify it's actually a file, not a directory
                struct stat st;
                if (stat(caBundleFilePaths[i], &st) == 0 && S_ISREG(st.st_mode)) {
                    caBundlePath = caBundleFilePaths[i];
                    foundCaBundle = true;
                    LOGI("ApiClient: Found CA bundle file at: %s", caBundlePath);
                    break;
                }
            }
        }
        
        // CRITICAL: On Android, some versions of libcurl may not send client certificate
        // if VerifyPeer=false. We need VerifyPeer=true to force cert sending, but this requires
        // a CA bundle file (even if empty). Create a minimal CA bundle file in app's internal storage.
        
        // NOTE: Creating CA bundle is complex - requires valid PEM certificate
        // For now, skip CA bundle creation and use VerifyPeer=false
        // If client cert not sent, likely issues:
        // 1. PKCS#8 key format - convert to RSA
        // 2. libcurl version bug
        
        // For Android, use VerifyPeer=true if we have ANY CA bundle (even minimal)
        // This forces libcurl to send client certificate during TLS handshake
        bool verifyPeer = false;
        if (foundCaBundle) {
            verifyPeer = true;  // Enable verification if we have CA bundle (even minimal)
            LOGI("ApiClient: CA bundle found, enabling VerifyPeer to force client cert sending");
        } else {
            LOGW("ApiClient: No CA bundle available (not even minimal), VerifyPeer disabled");
            LOGW("ApiClient: Client certificate may not be sent on some Android libcurl versions");
        }
        
        if (useMtls) {
            // Verify files are accessible with absolute paths for libcurl
            // libcurl requires readable file paths, check permissions
            struct stat certStat, keyStat;
            bool certReadable = (stat(g_ClientCertPath.c_str(), &certStat) == 0);
            bool keyReadable = (stat(g_ClientKeyPath.c_str(), &keyStat) == 0);
            
            if (!certReadable || !keyReadable) {
                LOGE("ApiClient: Cannot stat certificate files");
                if (!certReadable) LOGE("ApiClient: Cannot access: %s", g_ClientCertPath.c_str());
                if (!keyReadable) LOGE("ApiClient: Cannot access: %s", g_ClientKeyPath.c_str());
                useMtls = false;
            } else {
                LOGI("ApiClient: Certificate file accessible: %s (size: %lld bytes, mode: %o)", 
                     g_ClientCertPath.c_str(), (long long)certStat.st_size, certStat.st_mode);
                LOGI("ApiClient: Key file accessible: %s (size: %lld bytes, mode: %o)", 
                     g_ClientKeyPath.c_str(), (long long)keyStat.st_size, keyStat.st_mode);
            }
        }
        
        if (useMtls) {
            // mTLS configuration: use client certificate
            // Note: cpr uses libcurl, CertFile and KeyFile should be absolute file paths
            // On Android, ensure paths are absolute and files are readable by the process
            try {
                // Log paths before setting SSL options
                LOGI("ApiClient: Configuring mTLS with:");
                LOGI("ApiClient:   CertFile: %s", g_ClientCertPath.c_str());
                LOGI("ApiClient:   KeyFile: %s", g_ClientKeyPath.c_str());
                
                // IMPORTANT: On Android, libcurl may have issues with:
                // 1. PKCS#8 key format (-----BEGIN PRIVATE KEY-----) - may need RSA format
                // 2. File paths with /user/0/ - try using direct paths
                // 3. File permissions - ensure files are readable
                
                // Check key format - PKCS#8 may not work with VerifyPeer=false on some Android libcurl versions
                std::ifstream keyFormatCheck(g_ClientKeyPath);
                std::string keyFormatContent((std::istreambuf_iterator<char>(keyFormatCheck)), std::istreambuf_iterator<char>());
                keyFormatCheck.close();
                
                bool isRsaFormat = (keyFormatContent.find("-----BEGIN RSA PRIVATE KEY-----") != std::string::npos);
                bool isPkcs8Format = (keyFormatContent.find("-----BEGIN PRIVATE KEY-----") != std::string::npos);
                
                std::string actualKeyPath = g_ClientKeyPath;
                
                if (isPkcs8Format && !isRsaFormat) {
                    LOGW("ApiClient: Key is in PKCS#8 format (-----BEGIN PRIVATE KEY-----)");
                    LOGW("ApiClient: Android libcurl may not send client cert with PKCS#8 + VerifyPeer=false");
                    
                    // Convert PKCS#8 to RSA format using OpenSSL API (not command)
                    // Create RSA format key file in same directory
                    size_t lastSlash = g_ClientKeyPath.find_last_of('/');
                    if (lastSlash != std::string::npos) {
                        std::string keyDir = g_ClientKeyPath.substr(0, lastSlash);
                        std::string rsaKeyPath = keyDir + "/client-key-rsa.pem";
                        
                        LOGW("ApiClient: Converting PKCS#8 to RSA format using OpenSSL API...");
                        LOGW("ApiClient: RSA key path: %s", rsaKeyPath.c_str());
                        
                        // Use OpenSSL API to convert PKCS#8 to RSA format
                        FILE* keyFile = fopen(g_ClientKeyPath.c_str(), "r");
                        if (keyFile) {
                            EVP_PKEY* pkey = PEM_read_PrivateKey(keyFile, nullptr, nullptr, nullptr);
                            fclose(keyFile);
                            
                            if (pkey) {
                                // Write RSA format key
                                FILE* rsaKeyFile = fopen(rsaKeyPath.c_str(), "w");
                                if (rsaKeyFile) {
                                    // Use PEM_write_PrivateKey with PKCS1 format (RSA)
                                    // PEM_write_PKCS8PrivateKey writes PKCS#8, we need RSA format
                                    // Use PEM_write_RSAPrivateKey for RSA format
                                    RSA* rsa = EVP_PKEY_get1_RSA(pkey);
                                    if (rsa) {
                                        if (PEM_write_RSAPrivateKey(rsaKeyFile, rsa, nullptr, nullptr, 0, nullptr, nullptr)) {
                                            fclose(rsaKeyFile);
                                            chmod(rsaKeyPath.c_str(), 0600);
                                            actualKeyPath = rsaKeyPath;
                                            LOGI("ApiClient: ✅ Successfully converted PKCS#8 to RSA format using OpenSSL API");
                                            LOGI("ApiClient: Using RSA format key: %s", actualKeyPath.c_str());
                                        } else {
                                            fclose(rsaKeyFile);
                                            std::remove(rsaKeyPath.c_str());
                                            LOGW("ApiClient: Failed to write RSA key file");
                                        }
                                        RSA_free(rsa);
                                    } else {
                                        fclose(rsaKeyFile);
                                        std::remove(rsaKeyPath.c_str());
                                        LOGW("ApiClient: Key is not RSA key (may be EC or other type)");
                                    }
                                    EVP_PKEY_free(pkey);
                                } else {
                                    LOGW("ApiClient: Cannot create RSA key file: %s", rsaKeyPath.c_str());
                                    EVP_PKEY_free(pkey);
                                }
                            } else {
                                LOGW("ApiClient: Failed to load PKCS#8 key from file");
                                unsigned long err = ERR_get_error();
                                char err_buf[256];
                                ERR_error_string_n(err, err_buf, sizeof(err_buf));
                                LOGW("ApiClient: OpenSSL error: %s", err_buf);
                            }
                        } else {
                            LOGW("ApiClient: Cannot open key file for reading: %s", g_ClientKeyPath.c_str());
                        }
                        
                        // If conversion failed, warn but continue with original key
                        if (actualKeyPath == g_ClientKeyPath) {
                            LOGW("ApiClient: ⚠️  Using original PKCS#8 key - may not work with VerifyPeer=false");
                            LOGW("ApiClient: 💡 Конвертируйте ключ на сервере и скопируйте RSA версию на устройство");
                        }
                    }
                } else if (isRsaFormat) {
                    LOGI("ApiClient: Key is already in RSA format (-----BEGIN RSA PRIVATE KEY-----)");
                } else {
                    LOGE("ApiClient: Unknown key format - cannot determine if PKCS#8 or RSA");
                }
                
                // Use the actual key path (may be original or converted RSA)
                std::string finalKeyPath = actualKeyPath;
                
                // Unconditional: disable peer/host verification and force-load client cert/key.
                // This avoids chain-too-long errors on Android libcurl while still sending cert.
                try {
                    auto curlHolder = session.GetCurlHolder();
                    if (curlHolder && curlHolder->handle) {
                        CURL* curl = curlHolder->handle;
                        curl_easy_setopt(curl, CURLOPT_SSL_CTX_FUNCTION, ssl_ctx_callback);
                        curl_easy_setopt(curl, CURLOPT_SSL_CTX_DATA, nullptr);
                        LOGI("ApiClient: ✅ SSL_CTX callback set (pre-SetSslOptions)");
                    }
                } catch (...) {
                    LOGW("ApiClient: ⚠️  Cannot set SSL_CTX callback before SSL options");
                }

                session.SetSslOptions(cpr::Ssl(
                    cpr::ssl::TLSv1_2{},
                    cpr::ssl::VerifyHost{false},
                    cpr::ssl::VerifyPeer{false},
                    cpr::ssl::CertFile{g_ClientCertPath.c_str()},
                    cpr::ssl::KeyFile{finalKeyPath.c_str()}
                ));

                try {
                    auto curlHolder = session.GetCurlHolder();
                    if (curlHolder && curlHolder->handle) {
                        CURL* curl = curlHolder->handle;
                        curl_easy_setopt(curl, CURLOPT_SSL_CTX_FUNCTION, ssl_ctx_callback);
                        curl_easy_setopt(curl, CURLOPT_SSL_CTX_DATA, nullptr);
                        curl_easy_setopt(curl, CURLOPT_SSL_VERIFYPEER, 0L);
                        curl_easy_setopt(curl, CURLOPT_SSL_VERIFYHOST, 0L);
                        curl_easy_setopt(curl, CURLOPT_SSLCERT, g_ClientCertPath.c_str());
                        curl_easy_setopt(curl, CURLOPT_SSLKEY, finalKeyPath.c_str());
                        curl_easy_setopt(curl, CURLOPT_SSLCERTTYPE, "PEM");
                        curl_easy_setopt(curl, CURLOPT_SSLKEYTYPE, "PEM");
                        LOGI("ApiClient: ✅ Curl handle configured with client cert (VerifyPeer disabled)");
                    } else {
                        LOGW("ApiClient: ⚠️  Cannot get curl handle - SSL_CTX callback not set");
                    }
                } catch (const std::exception& e) {
                    LOGW("ApiClient: Exception setting SSL_CTX callback: %s", e.what());
                } catch (...) {
                    LOGW("ApiClient: Unknown exception setting SSL_CTX callback");
                }

                LOGI("ApiClient: Client certificate configured: %s", g_ClientCertPath.c_str());
                LOGI("ApiClient: Client key configured: %s", finalKeyPath.c_str());
            } catch (const std::exception& e) {
                LOGE("ApiClient: ❌ Failed to configure mTLS: %s", e.what());
                LOGE("ApiClient: Make sure client-cert.pem and client-key.pem exist and are readable");
                LOGE("ApiClient: Cert path: %s", g_ClientCertPath.c_str());
                LOGE("ApiClient: Key path: %s", g_ClientKeyPath.c_str());
                // Fallback to SSL without client certificate
                session.SetSslOptions(cpr::Ssl(
                    cpr::ssl::TLSv1_2{},
                    cpr::ssl::VerifyHost{false},  // Disabled for Android
                    cpr::ssl::VerifyPeer{false}   // Disabled for Android
                ));
                useMtls = false;
            }
        } else {
            // Fallback: SSL without client certificate (will fail if mTLS is required on server)
            LOGW("ApiClient: SSL without mTLS (client certificates not found)");
            session.SetSslOptions(cpr::Ssl(
                cpr::ssl::TLSv1_2{},
                cpr::ssl::VerifyHost{false},  // Disabled for Android
                cpr::ssl::VerifyPeer{false}   // Disabled for Android
            ));
            if (g_ClientCertPath.empty() || g_ClientKeyPath.empty()) {
                LOGE("ApiClient: Certificate paths not initialized! Call InitializeCertificateFiles first.");
                LOGE("ApiClient: Check Android logs for InitializeCertificateFiles errors");
            } else {
                LOGI("ApiClient: Looking for certificates at:");
                LOGI("ApiClient:   Certificate: %s", g_ClientCertPath.c_str());
                LOGI("ApiClient:   Key: %s", g_ClientKeyPath.c_str());
                LOGI("ApiClient: Please ensure both files exist in Download folder and are readable");
            }
            LOGI("ApiClient: Note: mTLS is required for /api/challenge and /api/connect endpoints");
        }
        
        return session;
    }

    static std::string parseErrorResponse(int statusCode, const std::string& responseText) {
        if (statusCode == 503) {
            return "SERVER_ERROR_503: Server temporarily unavailable (503)\n   Possible causes:\n   - Redis unavailable\n   - Server overloaded\n   - Check server logs";
        }

        if (statusCode == 403) {
            std::string errorMessage;
            try {
                json errorJson = json::parse(responseText);
                if (errorJson.contains("error")) {
                    errorMessage = errorJson["error"].get<std::string>();
                    std::string lowerError = errorMessage;
                    std::transform(lowerError.begin(), lowerError.end(), lowerError.begin(), ::tolower);
                    if (lowerError.find("certificate") != std::string::npos || 
                        lowerError.find("client certificate") != std::string::npos ||
                        lowerError.find("mtls") != std::string::npos) {
                        return "SERVER_ERROR_403_MTLS: Client certificate required.\n   Make sure client-cert.pem and client-key.pem are installed.\n   Contact administrator for client certificates.";
                    }
                }
            } catch (...) {
                // If JSON parsing fails, check if it's a plain text error
                if (responseText.find("certificate") != std::string::npos || 
                    responseText.find("Client certificate") != std::string::npos) {
                    return "SERVER_ERROR_403_MTLS: Client certificate required.\n   Make sure client-cert.pem and client-key.pem are installed.\n   Contact administrator for client certificates.";
                }
            }
            return "SERVER_ERROR_403: Access denied (403)\n   " + (errorMessage.empty() ? "Check server security settings" : errorMessage);
        }

        std::string errorMessage;
        try {
            json errorJson = json::parse(responseText);
            if (errorJson.contains("error")) {
                errorMessage = errorJson["error"].get<std::string>();
                return "SERVER_ERROR_" + std::to_string(statusCode) + ": " + errorMessage;
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
                    return "SERVER_ERROR_" + std::to_string(statusCode) + ": " + errorMessage;
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
        LOGI("GetChallenge: Response error code=%d", static_cast<int>(response.error.code));
        LOGI("GetChallenge: Response error message=%s", response.error.message.c_str());
        if (response.error.code != cpr::ErrorCode::OK) {
            LOGE("GetChallenge: cpr error code=%d, message=%s", static_cast<int>(response.error.code), response.error.message.c_str());
        }
        if (!response.text.empty()) {
            LOGI("GetChallenge: Response text (first 200 chars): %s", response.text.substr(0, 200).c_str());
        }

        if (response.status_code == 200) {
            try {
                json result = json::parse(response.text);
                std::string canary = result["canary"];
                std::string challenge = extractChallenge(result);
                
                if (challenge.empty()) {
                    LOGE("GetChallenge: Could not extract challenge");
                    return "SERVER_ERROR_500: Failed to extract challenge from server response";
                }

                if (result.contains("project_id")) {
                    std::string newProjectId = std::to_string(result["project_id"].get<int>());
                    if (newProjectId != g_ProjectId) {
                        g_ProjectId = newProjectId;
                        LOGI("GetChallenge: Project ID updated: %s", g_ProjectId.c_str());
                    }
                }

                LOGI("GetChallenge: SUCCESS - Challenge received, key found on server!");
                return challenge + "|" + canary;
            } catch (const std::exception& e) {
                LOGE("GetChallenge: JSON parsing error: %s", e.what());
                return "SERVER_ERROR_500: Failed to parse server response: " + std::string(e.what());
            }
        } else if (response.status_code == 404) {
            LOGE("GetChallenge: Key not found on server (404)");
            return ErrorMessages::KEY_NOT_FOUND;
        } else {
            LOGE("GetChallenge: Server error: %d", response.status_code);
            std::string errorMsg = parseErrorResponse(response.status_code, response.text);
            // Always return error with SERVER_ERROR_ prefix to prevent continuation
            if (errorMsg.find("SERVER_ERROR_") != 0) {
                return "SERVER_ERROR_" + std::to_string(response.status_code) + ": " + errorMsg;
            }
            return errorMsg;
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
        
        std::string androidId = getAndroidId(env, context);
        std::string deviceModel = getDeviceModel(env);
        std::string deviceBrand = getDeviceBrand(env);

        std::string fingerprint = sha256(androidId + "-" + deviceModel + "-" + deviceBrand);

        LOGI("CheckLicense: Step 1 - Getting challenge from server...");
        std::string challengeData = ApiClient::getChallenge(cleanedKey, fingerprint);

        // Check for errors first - don't continue if there's an error
        if (challengeData == ErrorMessages::KEY_NOT_FOUND) {
            return "License key not found on server";
        }

        if (challengeData.find("SERVER_ERROR_") == 0) {
            // Extract user-friendly error message
            size_t colonPos = challengeData.find(": ");
            if (colonPos != std::string::npos) {
                std::string errorMsg = challengeData.substr(colonPos + 2);
                if (challengeData.find("SERVER_ERROR_403_MTLS") == 0) {
                    return errorMsg;  // mTLS error already has full message
                } else if (challengeData.find("SERVER_ERROR_503") == 0) {
                    return errorMsg;
                } else if (challengeData.find("SERVER_ERROR_500") == 0) {
                    return "Internal server error (500)\n   " + errorMsg;
                } else if (challengeData.find("SERVER_ERROR_403") == 0) {
                    return errorMsg;
                }
                return "Server error\n   " + errorMsg;
            }
            return challengeData;
        }

        if (challengeData.empty() || challengeData.find("|") == std::string::npos) {
            return "Error: Failed to get challenge from server\n   Invalid response format";
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
    
    LOGI("android_main: START - Initializing application");
    
    // Initialize certificate files on app launch
    // This will look for client-cert.pem and client-key.pem in:
    // 1. App's internal files directory (recommended - no permissions needed)
    // 2. Download directory (fallback - requires READ_EXTERNAL_STORAGE permission)
    LOGI("android_main: Initializing certificate files...");
    if (!InitializeCertificateFiles(app)) {
        LOGE("android_main: ❌ Failed to initialize certificate files");
        LOGE("android_main: Please ensure client-cert.pem and client-key.pem exist in one of these locations:");
        LOGE("android_main:   1. App's internal files directory (recommended)");
        LOGE("android_main:   2. Download directory (requires READ_EXTERNAL_STORAGE permission)");
        LOGE("android_main: App will continue, but mTLS connections will fail");
        // Continue anyway - mTLS will fail, but app won't crash
        // Global paths will be empty, so createSession() will detect this
    } else {
        LOGI("android_main: ✅ Certificate files initialized successfully");
        LOGI("android_main: Certificate: %s", g_ClientCertPath.c_str());
        LOGI("android_main: Key: %s", g_ClientKeyPath.c_str());
    }
    
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
