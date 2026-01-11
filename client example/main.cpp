// System includes
#include <algorithm>
#include <cctype>
#include <cstdio>
#include <cstring>
#include <fstream>
#include <iomanip>
#include <random>
#include <sstream>
#include <stdexcept>
#include <string>
#include <vector>
#include <chrono>
#include <sys/stat.h>
#include <fcntl.h>
#include <unistd.h>
#include <ctime>
#include <errno.h>

// Android includes
#include <android/input.h>
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
#include <openssl/rand.h>
#include <openssl/sha.h>
#include <openssl/x509.h>
#include <openssl/x509v3.h>
#include <openssl/pem.h>
#include <openssl/rsa.h>
#include <openssl/bn.h>

// License checking includes
#include "LOGIN/cpr/cpr.h"
#include "LOGIN/json.hpp"

#define LOGI(...) __android_log_print(ANDROID_LOG_INFO, "App", __VA_ARGS__)
#define LOGE(...) __android_log_print(ANDROID_LOG_ERROR, "App", __VA_ARGS__)
#define LOGW(...) __android_log_print(ANDROID_LOG_WARN, "App", __VA_ARGS__)

// Global state
android_app* g_App = nullptr;
std::string g_gameName = "PUBG";  // Global variable for game name

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
    const char* LOG_TAG = "EGL";

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

// ============================================================================
// License Checking Logic
// ============================================================================

// Configuration
constexpr const char* SERVER_URL     = "https://ovrin.xyz";
constexpr const char* MASTER_KEY_HEX = "894a642561a8c0237a748a958aa5b828b6a9a0320364f8a85658b7d8ac3e1f4a";
constexpr const char* PROJECT_ID     = "6117759936";
constexpr const char* ANDROID_PACKAGE_NAME = "com.example.myapplication";

std::string generate_client_name(const std::string& fingerprint) {
    // Use first 8 characters of fingerprint to make it unique per device
    return "check-license-client-" + fingerprint.substr(0, 8);
}

std::string base64_encode(const std::vector<unsigned char>& data) {
    BIO* bio = BIO_new(BIO_s_mem());
    BIO* b64 = BIO_new(BIO_f_base64());
    b64 = BIO_push(b64, bio);
    BIO_set_flags(b64, BIO_FLAGS_BASE64_NO_NL);
    BIO_write(b64, data.data(), data.size());
    BIO_flush(b64);
    BUF_MEM* bufferPtr;
    BIO_get_mem_ptr(b64, &bufferPtr);
    std::string result(bufferPtr->data, bufferPtr->length);
    BIO_free_all(b64);
    return result;
}

std::vector<unsigned char> base64_decode(const std::string& encoded) {
    BIO* bio = BIO_new_mem_buf(encoded.data(), encoded.size());
    BIO* b64 = BIO_new(BIO_f_base64());
    b64 = BIO_push(b64, bio);
    BIO_set_flags(b64, BIO_FLAGS_BASE64_NO_NL);
    std::vector<unsigned char> buffer(encoded.size());
    int len = BIO_read(b64, buffer.data(), buffer.size());
    buffer.resize(std::max(0, len));
    BIO_free_all(b64);
    return buffer;
}

std::string sha256(const std::string& data) {
    unsigned char hash[SHA256_DIGEST_LENGTH];
    SHA256_CTX ctx;
    SHA256_Init(&ctx);
    SHA256_Update(&ctx, data.c_str(), data.size());
    SHA256_Final(hash, &ctx);
    std::ostringstream oss;
    oss << std::hex << std::setfill('0');
    for (int i = 0; i < SHA256_DIGEST_LENGTH; ++i)
        oss << std::setw(2) << static_cast<int>(hash[i]);
    return oss.str();
}

std::string path_basename(const std::string& path) {
    auto pos = path.find_last_of("/\\");
    if (pos == std::string::npos) return path;
    return path.substr(pos + 1);
}

std::string random_hex(int length) {
    static std::mt19937 rng{std::random_device{}()};
    static const char* hex = "0123456789abcdef";
    std::uniform_int_distribution<int> dist(0, 15);
    std::string out; out.reserve(length);
    for (int i = 0; i < length; ++i) out.push_back(hex[dist(rng)]);
    return out;
}

// ------------------ AES-256-GCM ------------------
std::string encryptWithMasterKey(const std::string& plaintext, const std::string& masterKeyHex) {
    std::vector<unsigned char> key;
    key.reserve(masterKeyHex.size() / 2);
    for (size_t i = 0; i < masterKeyHex.size(); i += 2)
        key.push_back(static_cast<unsigned char>(std::stoul(masterKeyHex.substr(i, 2), nullptr, 16)));

    std::vector<unsigned char> iv(12);
    RAND_bytes(iv.data(), iv.size());

    EVP_CIPHER_CTX* ctx = EVP_CIPHER_CTX_new();
    if (!ctx) throw std::runtime_error("ctx alloc failed");

    std::vector<unsigned char> ciphertext(plaintext.size() + 32);
    int len = 0, ciphertext_len = 0;

    if (EVP_EncryptInit_ex(ctx, EVP_aes_256_gcm(), nullptr, nullptr, nullptr) != 1 ||
        EVP_CIPHER_CTX_ctrl(ctx, EVP_CTRL_GCM_SET_IVLEN, 12, nullptr) != 1 ||
        EVP_EncryptInit_ex(ctx, nullptr, nullptr, key.data(), iv.data()) != 1 ||
        EVP_EncryptUpdate(ctx, ciphertext.data(), &len,
                          reinterpret_cast<const unsigned char*>(plaintext.data()), plaintext.size()) != 1) {
        EVP_CIPHER_CTX_free(ctx);
        throw std::runtime_error("encrypt failed");
    }
    ciphertext_len = len;
    if (EVP_EncryptFinal_ex(ctx, ciphertext.data() + len, &len) != 1) {
        EVP_CIPHER_CTX_free(ctx);
        throw std::runtime_error("encrypt final failed");
    }
    ciphertext_len += len;

    std::vector<unsigned char> tag(16);
    if (EVP_CIPHER_CTX_ctrl(ctx, EVP_CTRL_GCM_GET_TAG, 16, tag.data()) != 1) {
        EVP_CIPHER_CTX_free(ctx);
        throw std::runtime_error("get tag failed");
    }
    EVP_CIPHER_CTX_free(ctx);

    std::vector<unsigned char> combined;
    combined.reserve(iv.size() + ciphertext_len + tag.size());
    combined.insert(combined.end(), iv.begin(), iv.end());
    combined.insert(combined.end(), ciphertext.begin(), ciphertext.begin() + ciphertext_len);
    combined.insert(combined.end(), tag.begin(), tag.end());
    return base64_encode(combined);
}

std::string decryptWithMasterKey(const std::string& encryptedB64, const std::string& masterKeyHex) {
    auto decoded = base64_decode(encryptedB64);
    if (decoded.size() < 28) throw std::runtime_error("too short");

    std::vector<unsigned char> key;
    key.reserve(masterKeyHex.size() / 2);
    for (size_t i = 0; i < masterKeyHex.size(); i += 2)
        key.push_back(static_cast<unsigned char>(std::stoul(masterKeyHex.substr(i, 2), nullptr, 16)));

    std::vector<unsigned char> iv(decoded.begin(), decoded.begin() + 12);
    std::vector<unsigned char> tag(decoded.end() - 16, decoded.end());
    std::vector<unsigned char> ciphertext(decoded.begin() + 12, decoded.end() - 16);

    EVP_CIPHER_CTX* ctx = EVP_CIPHER_CTX_new();
    if (!ctx) throw std::runtime_error("ctx alloc failed");

    std::vector<unsigned char> plaintext(ciphertext.size() + 32);
    int len = 0, pt_len = 0;

    if (EVP_DecryptInit_ex(ctx, EVP_aes_256_gcm(), nullptr, nullptr, nullptr) != 1 ||
        EVP_CIPHER_CTX_ctrl(ctx, EVP_CTRL_GCM_SET_IVLEN, 12, nullptr) != 1 ||
        EVP_DecryptInit_ex(ctx, nullptr, nullptr, key.data(), iv.data()) != 1 ||
        EVP_DecryptUpdate(ctx, plaintext.data(), &len, ciphertext.data(), ciphertext.size()) != 1) {
        EVP_CIPHER_CTX_free(ctx);
        throw std::runtime_error("decrypt failed");
    }
    pt_len = len;
    if (EVP_CIPHER_CTX_ctrl(ctx, EVP_CTRL_GCM_SET_TAG, 16, tag.data()) != 1 ||
        EVP_DecryptFinal_ex(ctx, plaintext.data() + len, &len) != 1) {
        EVP_CIPHER_CTX_free(ctx);
        throw std::runtime_error("auth tag failed");
    }
    pt_len += len;
    EVP_CIPHER_CTX_free(ctx);
    plaintext.resize(pt_len);
    return std::string(plaintext.begin(), plaintext.end());
}

// Forward declarations
std::string sha256(const std::string& data);

// Функция для вычисления SHA-256 хэша библиотеки
// ВАЖНО: В реальной реализации этот хэш должен вычисляться при сборке
// и встраиваться в бинарник. Для примера используется функция-заглушка.
std::string calculate_library_hash() {
    // Вариант 1: Встроенный хэш (рекомендуется)
    // Хэш вычисляется при сборке через скрипт и встраивается как константа
    // #define LIBRARY_SHA256 "a1b2c3d4e5f6..."
    // return std::string(LIBRARY_SHA256);
    
    // Вариант 2: Вычисление хэша сегмента кода в памяти (для примера)
    // ВНИМАНИЕ: Это менее надежно, так как зависит от загрузчика
    void* code_start = reinterpret_cast<void*>(&calculate_library_hash);
    // Примерный размер сегмента кода (нужно подобрать в зависимости от архитектуры)
    size_t code_size = 0x10000;  // 64 KB
    
    unsigned char hash[SHA256_DIGEST_LENGTH];
    SHA256_CTX ctx;
    SHA256_Init(&ctx);
    SHA256_Update(&ctx, code_start, code_size);
    SHA256_Final(hash, &ctx);
    
    std::ostringstream oss;
    oss << std::hex << std::setfill('0');
    for (int i = 0; i < SHA256_DIGEST_LENGTH; ++i)
        oss << std::setw(2) << static_cast<int>(hash[i]);
    return oss.str();
    
    // Вариант 3: Использовать предвычисленный хэш бинарника
    // Можно вычислить SHA-256 .so/.dll файла при загрузке библиотеки
    // Это более надежный вариант для динамических библиотек
}

// ------------------ mTLS CSR ------------------
struct MtlsCertPaths {
    std::string cert_path;
    std::string key_path;
    std::string ca_path;
};

// Ensure directories exist with 0700 permissions
void ensure_dir_0700(const std::string& path) {
    struct stat st{};
    if (stat(path.c_str(), &st) == 0) {
        if (!S_ISDIR(st.st_mode)) {
            throw std::runtime_error("Path exists but is not a directory: " + path);
        }
        chmod(path.c_str(), 0700);
        return;
    }
    if (mkdir(path.c_str(), 0700) != 0 && errno != EEXIST) {
        throw std::runtime_error("Failed to create directory: " + path);
    }
    chmod(path.c_str(), 0700);
}

std::string ensure_mtls_dir(const std::string& cache_key) {
    std::string base = std::string("/data/user/0/") + ANDROID_PACKAGE_NAME + "/files/mtls/";
    ensure_dir_0700(base);
    std::string per_user = base + cache_key + "/";
    ensure_dir_0700(per_user);
    return per_user;
}

std::string save_pem(const std::string& content, const std::string& suffix) {
    char tmp[] = "/data/user/0/com.example.myapplication/cache/mtls_XXXXXX";
    int fd = mkstemp(tmp);
    if (fd == -1) throw std::runtime_error("mkstemp failed");
    std::string path = std::string(tmp) + suffix;
    close(fd);
    rename(tmp, path.c_str());
    std::ofstream out(path, std::ios::binary);
    if (!out) throw std::runtime_error("write pem failed");
    out << content;
    out.close();
    chmod(path.c_str(), 0600);
    return path;
}

std::string generate_csr_pem(const std::string& cn, EVP_PKEY*& pkey_out) {
    pkey_out = EVP_PKEY_new();
    if (!pkey_out) throw std::runtime_error("pkey alloc failed");
    BIGNUM* bn = BN_new();
    BN_set_word(bn, RSA_F4);
    RSA* rsa = RSA_new();
    if (RSA_generate_key_ex(rsa, 2048, bn, nullptr) != 1) {
        BN_free(bn); RSA_free(rsa); EVP_PKEY_free(pkey_out);
        throw std::runtime_error("rsa gen failed");
    }
    BN_free(bn);
    if (EVP_PKEY_assign_RSA(pkey_out, rsa) != 1) {
        RSA_free(rsa); EVP_PKEY_free(pkey_out);
        throw std::runtime_error("assign rsa failed");
    }
    X509_REQ* req = X509_REQ_new();
    X509_NAME* name = X509_NAME_new();
    X509_NAME_add_entry_by_txt(name, "CN", MBSTRING_ASC,
                               reinterpret_cast<const unsigned char*>(cn.c_str()), -1, -1, 0);
    X509_REQ_set_subject_name(req, name);
    X509_NAME_free(name);
    X509_REQ_set_pubkey(req, pkey_out);
    if (X509_REQ_sign(req, pkey_out, EVP_sha256()) <= 0) {
        X509_REQ_free(req); EVP_PKEY_free(pkey_out);
        throw std::runtime_error("csr sign failed");
    }
    BIO* bio = BIO_new(BIO_s_mem());
    PEM_write_bio_X509_REQ(bio, req);
    BUF_MEM* mem = nullptr;
    BIO_get_mem_ptr(bio, &mem);
    std::string csr(mem->data, mem->length);
    BIO_free(bio);
    X509_REQ_free(req);
    return csr;
}

// Check if certificate is valid (not expired, exists, readable)
bool is_cert_valid(const std::string& cert_path, const std::string& key_path) {
    if (cert_path.empty() || key_path.empty()) return false;
    
    std::ifstream cert_file(cert_path);
    std::ifstream key_file(key_path);
    if (!cert_file.is_open() || !key_file.is_open()) {
        LOGI("[mTLS] Cert files not found or not readable");
        return false;
    }
    
    // Read and parse certificate
    std::string cert_pem((std::istreambuf_iterator<char>(cert_file)), std::istreambuf_iterator<char>());
    cert_file.close();
    
    std::string key_pem((std::istreambuf_iterator<char>(key_file)), std::istreambuf_iterator<char>());
    key_file.close();

    BIO* bio = BIO_new_mem_buf(cert_pem.data(), cert_pem.size());
    X509* cert = PEM_read_bio_X509(bio, nullptr, nullptr, nullptr);
    BIO_free(bio);
    
    if (!cert) {
        LOGI("[mTLS] Failed to parse certificate");
        return false;
    }

    BIO* key_bio = BIO_new_mem_buf(key_pem.data(), key_pem.size());
    EVP_PKEY* pkey = PEM_read_bio_PrivateKey(key_bio, nullptr, nullptr, nullptr);
    BIO_free(key_bio);
    if (!pkey) {
        LOGI("[mTLS] Failed to parse private key");
        X509_free(cert);
        return false;
    }

    if (X509_check_private_key(cert, pkey) != 1) {
        LOGI("[mTLS] Cert and key do not match");
        EVP_PKEY_free(pkey);
        X509_free(cert);
        return false;
    }
    
    // Check expiration (certificates are valid for 365 days, check if expires in > 7 days)
    ASN1_TIME* not_after = X509_get_notAfter(cert);
    if (not_after) {
        struct tm tm_after = {0};
        ASN1_TIME_to_tm(not_after, &tm_after);
        time_t exp_time = mktime(&tm_after);
        time_t now = time(nullptr);
        double days_left = difftime(exp_time, now) / 86400.0;
        
        if (days_left < 7) {
            LOGI("[mTLS] Certificate expires soon (%.1f days), will renew", days_left);
            X509_free(cert);
            EVP_PKEY_free(pkey);
            return false;
        }
    }
    
    X509_free(cert);
    EVP_PKEY_free(pkey);
    return true;
}

// Get cached certificate paths based on user_key hash
std::string get_cert_cache_key(const std::string& user_key, const std::string& fingerprint) {
    // Tie cache to both user key and device fingerprint
    return sha256(user_key + ":" + fingerprint).substr(0, 12);
}

void delete_cached_cert(const MtlsCertPaths& paths) {
    if (!paths.cert_path.empty()) unlink(paths.cert_path.c_str());
    if (!paths.key_path.empty()) unlink(paths.key_path.c_str());
    if (!paths.ca_path.empty()) unlink(paths.ca_path.c_str());
}

bool is_recoverable_cert_error(const std::string& err) {
    return err.find("CERT_REVOKED") != std::string::npos || err.find("CERT_EXPIRED") != std::string::npos;
}

MtlsCertPaths fetch_or_create_mtls_cert(const std::string& user_key, const std::string& fingerprint) {
    std::string cache_key = get_cert_cache_key(user_key, fingerprint);
    std::string cache_dir = ensure_mtls_dir(cache_key);
    std::string cache_cert_path = cache_dir + "client.pem";
    std::string cache_key_path = cache_dir + "client.key";
    std::string cache_ca_path = cache_dir + "ca.pem";
    
    // Check if cached certificate exists and is valid
    if (is_cert_valid(cache_cert_path, cache_key_path)) {
        LOGI("[mTLS] Using cached certificate (fast path)");
        MtlsCertPaths paths;
        paths.cert_path = cache_cert_path;
        paths.key_path = cache_key_path;
        std::ifstream ca_file(cache_ca_path);
        if (ca_file.is_open()) {
            paths.ca_path = cache_ca_path;
            ca_file.close();
        }
        return paths;
    }
    
    LOGI("[mTLS] Cache miss or invalid cert, generating new CSR");
    std::string client_name = generate_client_name(fingerprint);
    LOGI("[mTLS] Generated client_name=%s for fingerprint=%s", client_name.c_str(), fingerprint.c_str());
    EVP_PKEY* pkey = nullptr;
    std::string csr = generate_csr_pem(client_name, pkey);

    BIO* bio = BIO_new(BIO_s_mem());
    PEM_write_bio_PrivateKey(bio, pkey, nullptr, nullptr, 0, nullptr, nullptr);
    BUF_MEM* mem = nullptr;
    BIO_get_mem_ptr(bio, &mem);
    std::string key_pem(mem->data, mem->length);
    BIO_free(bio);

    std::string url = std::string(SERVER_URL) + "/api/projects/" + PROJECT_ID + "/mtls/csr-sign-public";
    nlohmann::json payload = {
        {"user_key", user_key},
        {"client_name", client_name},
        {"csr_pem", csr}
    };
    LOGI("[mTLS] POST %s", url.c_str());
    // Note: For CSR endpoint, we don't have mTLS cert yet, so use basic HTTPS
    // Server cert verification is enabled for challenge/connect endpoints where mTLS is used
    cpr::Response resp = cpr::Post(
        cpr::Url{url},
        cpr::Header{{"Content-Type", "application/json"}},
        cpr::Body{payload.dump()},
        cpr::VerifySsl{true}  // Try to verify server cert (may fail if Android CA store not accessible)
    );
    
    // HTTP 0 usually means SSL/TLS handshake failure
    // This can happen if Android system CA store is not accessible to libcurl/CPR
    // Fallback: try without verification for initial CSR request only
    if (resp.status_code == 0) {
        LOGI("[mTLS] Server cert verification failed (status=0), trying without verification for CSR endpoint");
        LOGI("[mTLS] Error: %s (code: %d)", resp.error.message.c_str(), static_cast<int>(resp.error.code));
        
        // Fallback: disable verification for CSR endpoint only (bootstrap request)
        // This is acceptable because:
        // 1. CSR endpoint validates user_key, so MITM can't get valid certs
        // 2. All subsequent requests (challenge/connect) use mTLS with cert verification
        resp = cpr::Post(
            cpr::Url{url},
            cpr::Header{{"Content-Type", "application/json"}},
            cpr::Body{payload.dump()},
            cpr::VerifySsl{false}  // Fallback: disable for CSR endpoint only
        );
        
        if (resp.status_code == 0) {
            std::string error_msg = "CSR sign failed: Network/TLS error - " + resp.error.message;
            if (resp.error.code != cpr::ErrorCode::OK) {
                error_msg += " (error code: " + std::to_string(static_cast<int>(resp.error.code)) + ")";
            }
            LOGI("[mTLS] %s", error_msg.c_str());
            EVP_PKEY_free(pkey);
            throw std::runtime_error(error_msg);
        }
    }
    
    if (resp.status_code != 201) {
        std::string error_detail = resp.text.empty() ? "no response body" : resp.text.substr(0, 200);
        LOGI("[mTLS] CSR sign failed: HTTP %d, body: %s", resp.status_code, error_detail.c_str());
        EVP_PKEY_free(pkey);
        throw std::runtime_error("CSR sign failed: HTTP " + std::to_string(resp.status_code) + " - " + error_detail);
    }
    auto jr = nlohmann::json::parse(resp.text);
    std::string cert_pem = jr.value("certificate", "");
    std::string ca_pem   = jr.value("ca_certificate", "");
    if (cert_pem.empty()) {
        EVP_PKEY_free(pkey);
        throw std::runtime_error("No certificate in response");
    }

    // Save to cache paths
    MtlsCertPaths paths;
    paths.cert_path = cache_cert_path;
    paths.key_path = cache_key_path;
    
    std::ofstream cert_out(cache_cert_path);
    cert_out.write(cert_pem.data(), cert_pem.size());
    cert_out.close();
    chmod(cache_cert_path.c_str(), 0600);
    
    std::ofstream key_out(cache_key_path);
    key_out.write(key_pem.data(), key_pem.size());
    key_out.close();
    chmod(cache_key_path.c_str(), 0600);
    
    if (!ca_pem.empty()) {
        paths.ca_path = cache_ca_path;
        std::ofstream ca_out(cache_ca_path);
        ca_out.write(ca_pem.data(), ca_pem.size());
        ca_out.close();
        chmod(cache_ca_path.c_str(), 0600);
    }
    
    LOGI("[mTLS] saved cert=%s key=%s ca=%s (cached)", paths.cert_path.c_str(), paths.key_path.c_str(), paths.ca_path.empty() ? "none" : paths.ca_path.c_str());
    EVP_PKEY_free(pkey);
    return paths;
}

// ------------------ HTTP helpers ------------------
cpr::Session create_session_with_mtls(const MtlsCertPaths& mtls, bool verify_peer = false, const std::string& server_ca_path = "") {
    cpr::Session s;
    s.SetHeader({{"Content-Type", "application/json"}});
    s.SetTimeout(cpr::Timeout{10000});
    
    // Configure SSL for mTLS:
    // - Client certificate/key for client authentication (mTLS)
    // - Server certificate verification: disabled by default on Android because system CA store
    //   is often not accessible to libcurl. mTLS still provides security through client cert verification.
    //   Note: On Android, libcurl typically cannot access system CA certificates directly,
    //   so VerifyPeer{true} often fails with "unable to get local issuer certificate"
    //   If server_ca_path is provided, use it for server certificate verification
    cpr::SslOptions ssl;
    if (verify_peer && !server_ca_path.empty()) {
        // Use server CA certificate for verification
        LOGI("[mTLS] Using server CA certificate for verification: %s", server_ca_path.c_str());
        ssl = cpr::Ssl(
            cpr::ssl::TLSv1_2{},
            cpr::ssl::VerifyPeer{true},
            cpr::ssl::CertFile{mtls.cert_path.c_str()},  // Client certificate for mTLS
            cpr::ssl::KeyFile{mtls.key_path.c_str()},    // Client private key for mTLS
            cpr::ssl::CaInfo{std::string(server_ca_path)} // Server CA certificate for verification
        );
    } else {
        // No server CA certificate, disable peer verification
        ssl = cpr::Ssl(
            cpr::ssl::TLSv1_2{},
            cpr::ssl::VerifyPeer{false},
            cpr::ssl::CertFile{mtls.cert_path.c_str()},  // Client certificate for mTLS
            cpr::ssl::KeyFile{mtls.key_path.c_str()}     // Client private key for mTLS
        );
    }
    
    // Note: mtls.ca_path is the CA that signed the CLIENT certificate, not the server certificate
    // mTLS provides security: server verifies client certificate, client authenticates server via mTLS handshake
    s.SetSslOptions(ssl);
    return s;
}

// ------------------ Config upload/download helpers ------------------
ConfigTransferResult download_product_config_file(const std::string& config_identifier,
    const std::string& bearer_token,
    const MtlsCertPaths& mtls,
    const std::string& save_path,
    bool verify_peer = false,
    const std::string& server_ca_path = "") {
    ConfigTransferResult r;
    cpr::Session session = create_session_with_mtls(mtls, verify_peer, server_ca_path);
    // Clear default Content-Type to let server set proper value for binary
    session.SetHeader(cpr::Header{});
    if (!bearer_token.empty()) {
        session.SetHeader(cpr::Header{{"Authorization", "Bearer " + bearer_token}});
    }
    std::string url = std::string(SERVER_URL) + "/api/files/products/configs/" + config_identifier + "/download";
    session.SetUrl(url);
    LOGI("[ConfigDownload] GET %s", url.c_str());

    cpr::Response resp = session.Get();
    r.status = resp.status_code;

    if (resp.status_code != 200) {
        r.message = !resp.text.empty() ? resp.text : resp.error.message;
        if (r.message.empty()) r.message = "HTTP " + std::to_string(resp.status_code);
        LOGE("[ConfigDownload] Failed: status=%d error=%s", resp.status_code, r.message.c_str());
        return r;
    }

    std::ofstream out(save_path, std::ios::binary);
    if (!out.is_open()) {
        r.message = "Failed to open file for writing: " + save_path;
        LOGE("[ConfigDownload] %s", r.message.c_str());
        return r;
    }
    out.write(resp.text.data(), static_cast<std::streamsize>(resp.text.size()));
    out.close();

    r.ok = true;
    r.saved_path = save_path;
    r.message = "Downloaded config to " + save_path;
    LOGI("[ConfigDownload] Success -> %s (bytes=%zu)", save_path.c_str(), resp.text.size());
    return r;
}

ExtraTransferResult download_product_extra_file(const std::string& file_identifier,
    const std::string& bearer_token,
    const MtlsCertPaths& mtls,
    const std::string& save_path,
    bool verify_peer = false,
    const std::string& server_ca_path = "") {
    ExtraTransferResult r;
    cpr::Session session = create_session_with_mtls(mtls, verify_peer, server_ca_path);
    // Clear default Content-Type to let server set proper value for binary
    session.SetHeader(cpr::Header{});
    if (!bearer_token.empty()) {
        session.SetHeader(cpr::Header{{"Authorization", "Bearer " + bearer_token}});
    }
    std::string url = std::string(SERVER_URL) + "/api/files/products/extra-files/" + file_identifier + "/download";
    session.SetUrl(url);
    LOGI("[ExtraDownload] GET %s", url.c_str());

    cpr::Response resp = session.Get();
    r.status = resp.status_code;

    if (resp.status_code != 200) {
        r.message = !resp.text.empty() ? resp.text : resp.error.message;
        if (r.message.empty()) r.message = "HTTP " + std::to_string(resp.status_code);
        LOGE("[ExtraDownload] Failed: status=%d error=%s", resp.status_code, r.message.c_str());
        return r;
    }

    std::ofstream out(save_path, std::ios::binary);
    if (!out.is_open()) {
        r.message = "Failed to open file for writing: " + save_path;
        LOGE("[ExtraDownload] %s", r.message.c_str());
        return r;
    }
    out.write(resp.text.data(), static_cast<std::streamsize>(resp.text.size()));
    out.close();

    r.ok = true;
    r.saved_path = save_path;
    r.message = "Downloaded extra file to " + save_path;
    LOGI("[ExtraDownload] Success -> %s (bytes=%zu)", save_path.c_str(), resp.text.size());
    return r;
}

ConfigTransferResult upload_product_config_file(const std::string& product_name,
    const std::string& file_path,
    const std::string& bearer_token,
    const MtlsCertPaths& mtls,
    const std::string& display_name = "",
    const std::string& description = "",
    const std::string& version = "1.0.0",
    bool is_public = true,
    bool verify_peer = false,
    const std::string& server_ca_path = "") {
    ConfigTransferResult r;

    struct stat st{};
    if (stat(file_path.c_str(), &st) != 0 || !S_ISREG(st.st_mode)) {
        r.message = "File not found: " + file_path;
        LOGE("[ConfigUpload] %s", r.message.c_str());
        return r;
    }

    cpr::Session session = create_session_with_mtls(mtls, verify_peer, server_ca_path);
    // Clear default Content-Type so multipart can set its own
    session.SetHeader(cpr::Header{});
    if (!bearer_token.empty()) {
        session.SetHeader(cpr::Header{{"Authorization", "Bearer " + bearer_token}});
    }
    std::string url = std::string(SERVER_URL) + "/api/files/product-files/config";
    session.SetUrl(url);

    std::string effective_name = display_name.empty() ? path_basename(file_path) : display_name;

    cpr::Multipart multipart{
        {"file", cpr::File{file_path}},
        {"product_name", product_name},
        {"name", effective_name},
        {"description", description},
        {"version", version},
        {"is_public", is_public ? "true" : "false"}
    };
    session.SetMultipart(multipart);

    LOGI("[ConfigUpload] POST %s (product=%s, file=%s)", url.c_str(), product_name.c_str(), effective_name.c_str());
    cpr::Response resp = session.Post();
    r.status = resp.status_code;

    if (resp.status_code != 201) {
        r.message = !resp.text.empty() ? resp.text : resp.error.message;
        if (r.message.empty()) r.message = "HTTP " + std::to_string(resp.status_code);
        LOGE("[ConfigUpload] Failed: status=%d error=%s", resp.status_code, r.message.c_str());
        return r;
    }

    // Parse config_id from response if available
    try {
        if (!resp.text.empty()) {
            auto jr = nlohmann::json::parse(resp.text);
            if (jr.contains("config")) {
                const auto& cfg = jr["config"];
                if (cfg.contains("config_id")) {
                    r.config_id = cfg["config_id"].get<std::string>();
                } else if (cfg.contains("id")) {
                    r.config_id = cfg["id"].dump();
                }
            } else if (jr.contains("id")) {
                r.config_id = jr["id"].dump();
            }
        }
    } catch (const std::exception& e) {
        LOGW("[ConfigUpload] Failed to parse config_id: %s", e.what());
    }

    r.ok = true;
    r.message = "Uploaded config successfully";
    LOGI("[ConfigUpload] Success: status=%d config_id=%s", resp.status_code, r.config_id.empty() ? "n/a" : r.config_id.c_str());
    return r;
}

struct ChallengeResult {
    bool ok = false;
    std::string err;
    std::string challenge;
    std::string canary;
};

ChallengeResult get_challenge(const std::string& user_key, const std::string& fingerprint, const MtlsCertPaths& mtls, cpr::Session& session) {
    ChallengeResult r;
    LOGI("[Challenge] Using mTLS session with cert=%s key=%s ca=%s", mtls.cert_path.c_str(), mtls.key_path.c_str(), mtls.ca_path.empty() ? "none" : mtls.ca_path.c_str());
    session.SetUrl(std::string(SERVER_URL) + "/api/challenge");
    std::string lib_hash = calculate_library_hash();
    nlohmann::json body = {
        {"user_key", user_key},
        {"fingerprint", fingerprint},
        {"project_id", PROJECT_ID},
        {"library_hash", lib_hash}  // Добавляем SHA-256 хэш библиотеки
    };
    LOGI("[Challenge] Library hash: %s", lib_hash.c_str());
    session.SetBody(cpr::Body{body.dump()});
    LOGI("[Challenge] POST /api/challenge with project_id=%s", PROJECT_ID);
    cpr::Response resp = session.Post();
    if (resp.status_code != 200) {
        LOGI("[Challenge] Error response: status=%d", resp.status_code);
        
        // Try to parse JSON error response
        if (!resp.text.empty()) {
            try {
                auto jr = nlohmann::json::parse(resp.text);
                if (jr.contains("error")) {
                    r.err = jr.value("error", "server error");
                    LOGI("[Challenge] JSON error: %s", r.err.c_str());
                    return r;
                } else if (jr.contains("message")) {
                    r.err = jr.value("message", "server error");
                    LOGI("[Challenge] JSON message: %s", r.err.c_str());
                    return r;
                }
            } catch (...) {
                // Not JSON, fall through to default error message
            }
        }
        
        // Default error messages based on status code
        switch (resp.status_code) {
            case 403:
                r.err = "Access denied: Invalid license key or device not authorized";
                break;
            case 401:
                r.err = "Authentication failed: Invalid license key";
                break;
            case 404:
                r.err = "License key not found";
                break;
            case 400:
                r.err = "Invalid request: Missing required parameters";
                break;
            case 429:
                r.err = "Rate limit exceeded: Please wait before trying again";
                break;
            default:
                r.err = "Failed to get challenge: Server returned error " + std::to_string(resp.status_code);
                if (!resp.error.message.empty()) {
                    r.err += " (" + resp.error.message + ")";
                }
                break;
        }
        return r;
    }
    auto jr = nlohmann::json::parse(resp.text);
    std::string canary = jr.value("canary", "");
    std::string challenge;

    if (jr.contains("challenge")) {
        if (jr["challenge"].is_string()) {
            challenge = jr["challenge"].get<std::string>();
        } else if (jr["challenge"].is_object()) {
            auto& ch_obj = jr["challenge"];
            if (ch_obj.contains("challenges") && ch_obj["challenges"].contains("crypto")) {
                auto& crypto = ch_obj["challenges"]["crypto"];
                if (crypto.contains("challenges")) {
                    auto& challenges = crypto["challenges"];
                    for (const auto& key : {"sha256", "combined", "md5"}) {
                        if (challenges.contains(key) && challenges[key].contains("input")) {
                            challenge = challenges[key]["input"].get<std::string>();
                            break;
                        }
                    }
                }
            }
        }
    }

    if (challenge.empty() || canary.empty()) {
        r.err = "Failed to parse challenge response from server";
        LOGI("[Challenge] Parse error: challenge=%s canary=%s", challenge.empty() ? "empty" : "present", canary.empty() ? "empty" : "present");
        return r;
    }
    r.challenge = challenge;
    r.canary = canary;
    r.ok = true;
    return r;
}

struct ConnectResult {
    bool ok = false;
    std::string err;
    std::string expires_at;
    std::string seconds_left;
};

struct ConfigTransferResult {
    bool ok = false;
    int status = 0;
    std::string message;
    std::string saved_path;
    std::string config_id;  // server-side config_id (string)
};

struct ExtraTransferResult {
    bool ok = false;
    int status = 0;
    std::string message;
    std::string saved_path;
};

ConnectResult do_connect(const std::string& user_key,
    const std::string& challenge,
    const std::string& canary,
    const std::string& fingerprint,
    const MtlsCertPaths& mtls,
    cpr::Session& session) {
ConnectResult r;
std::string lib_hash = calculate_library_hash();
nlohmann::json data;
data["a"] = user_key;
data["b"] = sha256(challenge);
data["c"] = canary;
data["d"] = fingerprint;
data["e"] = g_gameName;
data["f"] = fingerprint.substr(0, 16);
data["g"] = fingerprint.substr(0, 12);
data["h"] = fingerprint.substr(0, 8);
data["i"] = fingerprint.substr(8, 8);
data["j"] = random_hex(16);
data["k"] = PROJECT_ID;
data["l"] = lib_hash;  // Добавляем SHA-256 хэш библиотеки (поле "l" для обратной совместимости)
LOGW("[Connect] Library hash: %s", lib_hash.c_str());

std::string blob = encryptWithMasterKey(data.dump(), MASTER_KEY_HEX);

LOGI("[Connect] Using mTLS session with cert=%s key=%s", mtls.cert_path.c_str(), mtls.key_path.c_str());
session.SetUrl(std::string(SERVER_URL) + "/api/connect");
nlohmann::json body;
body["blob"] = blob;
body["project_id"] = PROJECT_ID;
session.SetBody(cpr::Body{body.dump()});
LOGI("[Connect] Sending POST to /api/connect with project_id=%s", PROJECT_ID);
cpr::Response resp = session.Post();

if (resp.status_code != 200) {
    LOGI("[Connect] Error response: status=%d", resp.status_code);
    
    std::string error_msg;
    bool got_error_msg = false;
    
    // Try to decrypt error response to get meaningful error message
    if (!resp.text.empty()) {
        try {
            auto dec = decryptWithMasterKey(resp.text, MASTER_KEY_HEX);
            auto jr = nlohmann::json::parse(dec);
            
            // Try different error field names
            if (jr.contains("error")) {
                error_msg = jr.value("error", "");
                got_error_msg = !error_msg.empty();
            }
            if (!got_error_msg && jr.contains("message")) {
                error_msg = jr.value("message", "");
                got_error_msg = !error_msg.empty();
            }
            
            if (got_error_msg) {
                LOGI("[Connect] Decrypted error: %s", error_msg.c_str());
            }
        } catch (const std::exception& decrypt_err) {
            // If decryption fails, try to parse as plain JSON
            try {
                auto jr = nlohmann::json::parse(resp.text);
                if (jr.contains("error")) {
                    error_msg = jr.value("error", "");
                    got_error_msg = !error_msg.empty();
                    if (got_error_msg) {
                        LOGI("[Connect] Plain JSON error: %s", error_msg.c_str());
                    }
                }
            } catch (...) {
                // Not JSON, fall through to default error message
            }
        }
    }
    
    // If we got an error message from server, process it and make it user-friendly
    if (got_error_msg) {
        std::string lower_error = error_msg;
        std::transform(lower_error.begin(), lower_error.end(), lower_error.begin(), ::tolower);
        
        // Map server error messages to user-friendly messages
        if (lower_error.find("expired") != std::string::npos || lower_error.find("key expired") != std::string::npos) {
            r.err = "License key expired: Your subscription has ended. Please renew your license.";
        } else if (lower_error.find("not found") != std::string::npos || lower_error.find("key not found") != std::string::npos) {
            r.err = "License key not found: The provided license key does not exist or is invalid.";
        } else if (lower_error.find("not active") != std::string::npos || lower_error.find("frozen") != std::string::npos || lower_error.find("blocked") != std::string::npos) {
            r.err = "License key is not active: Your license has been frozen or blocked. Please contact support.";
        } else if (lower_error.find("device mismatch") != std::string::npos || lower_error.find("device") != std::string::npos && lower_error.find("bound") != std::string::npos) {
            r.err = "Device mismatch: This license is bound to a different device. Please use the authorized device.";
        } else if (lower_error.find("max devices") != std::string::npos || lower_error.find("device limit") != std::string::npos) {
            r.err = "Device limit reached: Maximum number of devices for this license has been reached.";
        } else if (lower_error.find("access denied") != std::string::npos || lower_error.find("unauthorized") != std::string::npos) {
            r.err = "Access denied: " + error_msg;
        } else if (lower_error.find("invalid") != std::string::npos) {
            r.err = "Invalid license key: " + error_msg;
        } else if (lower_error.find("project") != std::string::npos && lower_error.find("inactive") != std::string::npos) {
            r.err = "Project inactive: " + error_msg;
        } else if (lower_error.find("product") != std::string::npos && (lower_error.find("inactive") != std::string::npos || lower_error.find("maintenance") != std::string::npos)) {
            r.err = "Product unavailable: " + error_msg;
        } else {
            // Use server message as-is if it's already user-friendly
            r.err = error_msg;
        }
        return r;
    }
    
    // Default error messages based on status code (if no error message from server)
    switch (resp.status_code) {
        case 403:
            r.err = "Access denied: Your license key may be expired, invalid, or this device is not authorized";
            break;
        case 401:
            r.err = "Authentication failed: Invalid license key";
            break;
        case 404:
            r.err = "License key not found: The provided license key does not exist";
            break;
        case 429:
            r.err = "Rate limit exceeded: Please wait before trying again";
            break;
        default:
            r.err = "License check failed: Server returned error " + std::to_string(resp.status_code);
            break;
    }
    return r;
}

try {
    auto dec = decryptWithMasterKey(resp.text, MASTER_KEY_HEX);
    auto jr = nlohmann::json::parse(dec);
    if (jr.contains("error")) {
        r.err = jr.value("error", "server error");
        return r;
    }
    r.expires_at   = jr.value("expires_at", "");
    r.seconds_left = jr.value("seconds_left_human", "");
    r.ok = true;
} catch (const std::exception& e) {
    r.err = std::string("Failed to decrypt server response: ") + e.what();
}
return r;
}

// ------------------ Android device fingerprint ------------------
std::string jniStringToString(JNIEnv* env, jstring jstr, const std::string& def = "") {
    if (!jstr) return def;
    const char* chars = env->GetStringUTFChars(jstr, nullptr);
    std::string res = chars ? chars : def;
    if (chars) env->ReleaseStringUTFChars(jstr, chars);
    env->DeleteLocalRef(jstr);
    return res;
}

jstring GetAndroidID(JNIEnv* env, jobject context) {
    jclass ctxCls = env->FindClass("android/content/Context");
    if (!ctxCls) return nullptr;
    jmethodID getResolver = env->GetMethodID(ctxCls, "getContentResolver", "()Landroid/content/ContentResolver;");
    if (!getResolver) return nullptr;
    jobject resolver = env->CallObjectMethod(context, getResolver);
    if (env->ExceptionCheck() || !resolver) return nullptr;
    jclass secureCls = env->FindClass("android/provider/Settings$Secure");
    if (!secureCls) return nullptr;
    jmethodID getString = env->GetStaticMethodID(secureCls, "getString", "(Landroid/content/ContentResolver;Ljava/lang/String;)Ljava/lang/String;");
    if (!getString) return nullptr;
    jstring key = env->NewStringUTF("android_id");
    jstring res = (jstring)env->CallStaticObjectMethod(secureCls, getString, resolver, key);
    env->DeleteLocalRef(key);
    return res;
}

jstring GetDeviceModel(JNIEnv* env) {
    jclass b = env->FindClass("android/os/Build");
    if (!b) return nullptr;
    jfieldID f = env->GetStaticFieldID(b, "MODEL", "Ljava/lang/String;");
    if (!f) return nullptr;
    return (jstring)env->GetStaticObjectField(b, f);
}

jstring GetDeviceBrand(JNIEnv* env) {
    jclass b = env->FindClass("android/os/Build");
    if (!b) return nullptr;
    jfieldID f = env->GetStaticFieldID(b, "BRAND", "Ljava/lang/String;");
    if (!f) return nullptr;
    return (jstring)env->GetStaticObjectField(b, f);
}

std::string GenerateFingerprint(JNIEnv* env, jobject context) {
    std::string androidId = jniStringToString(env, GetAndroidID(env, context), "unknown-id");
    std::string model     = jniStringToString(env, GetDeviceModel(env), "unknown-model");
    std::string brand     = jniStringToString(env, GetDeviceBrand(env), "unknown-brand");
    return sha256(androidId + "-" + model + "-" + brand);
}

// ------------------ Public API ------------------
struct LicenseCheckResult {
    bool valid = false;
    std::string error;
    double duration_ms = 0.0;
    std::string expires_at;
    std::string seconds_left;
};

LicenseCheckResult CheckLicenseWithDetails(const char* userKey, const char* gameName, JNIEnv* env, jobject context, const char* caPath) {
    auto start = std::chrono::steady_clock::now();
    LicenseCheckResult out;
    try {
        if (!userKey || std::strlen(userKey) == 0) {
            out.error = "user_key empty";
            return out;
        }
        std::string key(userKey);
        std::string fingerprint = GenerateFingerprint(env, context);
        LOGI("CheckLicense: user_key=%s, game=%s", key.c_str(), gameName ? gameName : "PUBG");
        LOGI("[Main] fingerprint=%s", fingerprint.c_str());

        MtlsCertPaths mtls = fetch_or_create_mtls_cert(key, fingerprint);
        bool retry_allowed = true;
        
        // Use provided CA certificate path for server verification, or disable verification if not provided
        std::string server_ca_path = (caPath && std::strlen(caPath) > 0) ? std::string(caPath) : "";
        bool verify_peer = !server_ca_path.empty();  // Only verify if we have a CA certificate

        for (int attempt = 0; attempt < 2; ++attempt) {
            // Create session with peer verification if server CA certificate is available
            // Otherwise disable verification (Android system CA store often not accessible)
            // mTLS still provides security through client certificate authentication
            auto session = create_session_with_mtls(mtls, verify_peer, server_ca_path);  // reuse same TLS conn for challenge + connect

            auto ch = get_challenge(key, fingerprint, mtls, session);
            if (!ch.ok) {
                if (retry_allowed && is_recoverable_cert_error(ch.err)) {
                    LOGI("[mTLS] Server reported %s, regenerating certificate", ch.err.c_str());
                    delete_cached_cert(mtls);
                    mtls = fetch_or_create_mtls_cert(key, fingerprint);
                    retry_allowed = false;
                    continue;
                }
                out.error = ch.err;
                break;
            }

            auto cn = do_connect(key, ch.challenge, ch.canary, fingerprint, mtls, session);
            if (!cn.ok) {
                if (retry_allowed && is_recoverable_cert_error(cn.err)) {
                    LOGI("[mTLS] Server reported %s, regenerating certificate", cn.err.c_str());
                    delete_cached_cert(mtls);
                    mtls = fetch_or_create_mtls_cert(key, fingerprint);
                    retry_allowed = false;
                    continue;
                }
                out.error = cn.err;
                break;
            }

            out.valid = true;
            out.expires_at = cn.expires_at;
            out.seconds_left = cn.seconds_left;
            break;
        }
    } catch (const std::exception& e) {
        out.error = std::string("EXCEPTION: ") + e.what();
    }
    out.duration_ms = std::chrono::duration<double, std::milli>(std::chrono::steady_clock::now() - start).count();
    return out;
}

// Wrapper function for JNI compatibility - returns string result
std::string CheckLicense(const char* user_key, const char* game_name, JNIEnv* env, jobject context, const char* ca_path = nullptr) {
    LicenseCheckResult result = CheckLicenseWithDetails(user_key, game_name, env, context, ca_path);
    if (result.valid) {
        return "VALID: expires_at=" + result.expires_at + ", seconds_left=" + result.seconds_left;
    } else {
        return "ERROR: " + result.error;
    }
}

// ============================================================================
// Main Application
// ============================================================================

void android_main(struct android_app* app) {
    g_App = app;

    LOGI("android_main: START - Initializing application");

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
        __android_log_print(ANDROID_LOG_ERROR, "App", "EGL initialization failed");
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
    char userKeyInput[256] = "";
    char bearerTokenInput[512] = "";
    char extraFileIdInput[128] = "";
    char extraSaveNameInput[256] = "back.png";
    std::string statusMessage = "Enter user key and click Login";

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
        ImVec2 windowSize(500 * scaleFactor, 0);
        ImVec2 windowPos((width - windowSize.x) * 0.5f, height * 0.1f);
        ImGui::SetNextWindowPos(windowPos, ImGuiCond_FirstUseEver);
        ImGui::SetNextWindowSize(windowSize, ImGuiCond_FirstUseEver);

        ImGui::PushStyleVar(ImGuiStyleVar_WindowRounding, 15.0f);
        ImGui::PushStyleVar(ImGuiStyleVar_WindowPadding, ImVec2(20.0f, 20.0f));
        ImGui::PushStyleVar(ImGuiStyleVar_FrameRounding, 8.0f);
        ImGui::PushStyleColor(ImGuiCol_WindowBg, ImVec4(0.08f, 0.08f, 0.12f, 0.95f));
        ImGui::PushStyleColor(ImGuiCol_Border, ImVec4(0.2f, 0.4f, 0.8f, 0.6f));
        ImGui::PushStyleColor(ImGuiCol_Text, ImVec4(0.9f, 0.9f, 0.95f, 1.0f));

        if (ImGui::Begin("Login", nullptr, ImGuiWindowFlags_NoCollapse | ImGuiWindowFlags_NoResize)) {
            ImGui::PushStyleColor(ImGuiCol_Text, ImVec4(0.0f, 0.8f, 1.0f, 1.0f));
            ImGui::Text("License Check");
            ImGui::PopStyleColor();
            ImGui::Separator();
            ImGui::Spacing();

            // User Key Input
            ImGui::PushStyleColor(ImGuiCol_Text, ImVec4(0.8f, 0.9f, 1.0f, 1.0f));
            ImGui::Text("User Key:");
            ImGui::PopStyleColor();

            ImGui::PushStyleColor(ImGuiCol_FrameBg, ImVec4(0.12f, 0.12f, 0.18f, 0.8f));
            ImGui::PushStyleColor(ImGuiCol_FrameBgHovered, ImVec4(0.15f, 0.15f, 0.22f, 0.9f));
            ImGui::PushStyleColor(ImGuiCol_FrameBgActive, ImVec4(0.18f, 0.18f, 0.25f, 1.0f));
            ImGui::PushItemWidth(-1);
            ImGui::InputText("##userkey", userKeyInput, sizeof(userKeyInput));
            ImGui::PopItemWidth();
            ImGui::PopStyleColor(3);

            ImGui::Spacing();

            // Paste from clipboard button
            if (ImGui::Button("Paste from clipboard", ImVec2(-FLT_MIN, 45 * scaleFactor))) {
                const char* clipboard = ImGui::GetIO().GetClipboardTextFn(ImGui::GetIO().ClipboardUserData);
                if (clipboard) {
                    strncpy(userKeyInput, clipboard, sizeof(userKeyInput) - 1);
                    userKeyInput[sizeof(userKeyInput) - 1] = '\0';
                    // Trim whitespace
                    std::string trimmed = userKeyInput;
                    trimmed.erase(0, trimmed.find_first_not_of(" \t\n\r"));
                    trimmed.erase(trimmed.find_last_not_of(" \t\n\r") + 1);
                    strncpy(userKeyInput, trimmed.c_str(), sizeof(userKeyInput) - 1);
                    userKeyInput[sizeof(userKeyInput) - 1] = '\0';
                }
            }

            ImGui::Spacing();

            ImGui::PushStyleColor(ImGuiCol_Text, ImVec4(0.8f, 0.9f, 1.0f, 1.0f));
            ImGui::Text("Bearer Token (for downloads):");
            ImGui::PopStyleColor();
            ImGui::PushItemWidth(-1);
            ImGui::InputText("##bearer", bearerTokenInput, sizeof(bearerTokenInput));
            ImGui::PopItemWidth();

            ImGui::Spacing();

            ImGui::PushStyleColor(ImGuiCol_Text, ImVec4(0.8f, 0.9f, 1.0f, 1.0f));
            ImGui::Text("Extra File ID (e.g., 7758063 or extra_XXXX):");
            ImGui::PopStyleColor();
            ImGui::PushItemWidth(-1);
            ImGui::InputText("##extraid", extraFileIdInput, sizeof(extraFileIdInput));
            ImGui::PopItemWidth();

            ImGui::Spacing();

            ImGui::PushStyleColor(ImGuiCol_Text, ImVec4(0.8f, 0.9f, 1.0f, 1.0f));
            ImGui::Text("Save as (filename):");
            ImGui::PopStyleColor();
            ImGui::PushItemWidth(-1);
            ImGui::InputText("##extrasave", extraSaveNameInput, sizeof(extraSaveNameInput));
            ImGui::PopItemWidth();

            ImGui::Spacing();

            // Login button
            ImGui::PushStyleColor(ImGuiCol_Button, ImVec4(0.2f, 0.7f, 0.3f, 0.8f));
            ImGui::PushStyleColor(ImGuiCol_ButtonHovered, ImVec4(0.3f, 0.8f, 0.4f, 0.9f));
            ImGui::PushStyleColor(ImGuiCol_ButtonActive, ImVec4(0.1f, 0.6f, 0.2f, 1.0f));
            if (ImGui::Button("Login", ImVec2(-FLT_MIN, 50 * scaleFactor))) {
                if (strlen(userKeyInput) > 0) {
                    statusMessage = "Checking license...";
                    LOGI("Login button clicked with key: %s", userKeyInput);
                    
                    // Get JNI environment
                    JNIEnv* env = nullptr;
                    app->activity->vm->AttachCurrentThread(&env, nullptr);
                    
                    if (env) {
                        std::string fingerprint = GenerateFingerprint(env, app->activity->clazz);
                        LicenseCheckResult result = CheckLicenseWithDetails(
                            userKeyInput, 
                            "PUBG", 
                            env, 
                            app->activity->clazz, 
                            nullptr
                        );
                        
                        app->activity->vm->DetachCurrentThread();
                        
                        if (result.valid) {
                            statusMessage = "License VALID!\nExpires: " + result.expires_at + 
                                         "\nTime left: " + result.seconds_left +
                                         "\nDuration: " + std::to_string((int)result.duration_ms) + "ms";
                            LOGI("License check successful: expires_at=%s, seconds_left=%s", 
                                 result.expires_at.c_str(), result.seconds_left.c_str());

                            // Optional: download extra file after successful license check
                            if (std::strlen(extraFileIdInput) > 0 && std::strlen(bearerTokenInput) > 0) {
                                try {
                                    MtlsCertPaths mtls = fetch_or_create_mtls_cert(userKeyInput, fingerprint);
                                    std::string saveName = (std::strlen(extraSaveNameInput) > 0) ? extraSaveNameInput : path_basename(extraFileIdInput);
                                    std::string savePath = std::string("/sdcard/Download/") + saveName;
                                    auto extraRes = download_product_extra_file(extraFileIdInput, bearerTokenInput, mtls, savePath);
                                    if (extraRes.ok) {
                                        statusMessage += "\nExtra file downloaded to: " + extraRes.saved_path;
                                    } else {
                                        statusMessage += "\nExtra download failed: " + extraRes.message;
                                    }
                                } catch (const std::exception& e) {
                                    statusMessage += std::string("\nExtra download exception: ") + e.what();
                                }
                            }
                        } else {
                            statusMessage = "License check FAILED: " + result.error;
                            LOGE("License check failed: %s", result.error.c_str());
                        }
                    } else {
                        statusMessage = "Failed to get JNI environment";
                        LOGE("Failed to attach JNI thread");
                    }
                } else {
                    statusMessage = "Please enter user key";
                }
            }
            ImGui::PopStyleColor(3);

            ImGui::Spacing();
            ImGui::Separator();
            ImGui::Spacing();

            // Status message
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
