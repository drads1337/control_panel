// Minimal native license checker (Android, mTLS, AES-256-GCM)
// All UI/OpenGL/ImGui and legacy embedded certs removed.

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

#include <android/log.h>
#include <jni.h>

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

#include "LOGIN/cpr/cpr.h"
#include "LOGIN/json.hpp"

#define LOGI(...) __android_log_print(ANDROID_LOG_INFO, "App", __VA_ARGS__)
#define LOGE(...) __android_log_print(ANDROID_LOG_ERROR, "App", __VA_ARGS__)
#define LOGW(...) __android_log_print(ANDROID_LOG_WARN, "App", __VA_ARGS__)

// Configuration
constexpr const char* SERVER_URL     = "https://ovrin.xyz";
constexpr const char* MASTER_KEY_HEX = "894a642561a8c0237a748a958aa5b828b6a9a0320364f8a85658b7d8ac3e1f4a";
constexpr const char* PROJECT_ID     = "6117759936";
constexpr const char* CLIENT_NAME    = "check-license-client";

// ------------------ Utility: base64 & SHA256 ------------------
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

// ------------------ mTLS CSR ------------------
struct MtlsCertPaths {
    std::string cert_path;
    std::string key_path;
    std::string ca_path;
};

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

MtlsCertPaths fetch_or_create_mtls_cert(const std::string& user_key) {
    LOGI("[mTLS] generating CSR");
    EVP_PKEY* pkey = nullptr;
    std::string csr = generate_csr_pem(CLIENT_NAME, pkey);

    BIO* bio = BIO_new(BIO_s_mem());
    PEM_write_bio_PrivateKey(bio, pkey, nullptr, nullptr, 0, nullptr, nullptr);
    BUF_MEM* mem = nullptr;
    BIO_get_mem_ptr(bio, &mem);
    std::string key_pem(mem->data, mem->length);
    BIO_free(bio);

    std::string url = std::string(SERVER_URL) + "/api/projects/" + PROJECT_ID + "/mtls/csr-sign-public";
    nlohmann::json payload = {
        {"user_key", user_key},
        {"client_name", CLIENT_NAME},
        {"csr_pem", csr}
    };
    LOGI("[mTLS] POST %s", url.c_str());
    cpr::Response resp = cpr::Post(
        cpr::Url{url},
        cpr::Header{{"Content-Type", "application/json"}},
        cpr::Body{payload.dump()},
        cpr::VerifySsl{false}
    );
    if (resp.status_code != 201) {
        throw std::runtime_error("CSR sign failed: HTTP " + std::to_string(resp.status_code));
    }
    auto jr = nlohmann::json::parse(resp.text);
    std::string cert_pem = jr.value("certificate", "");
    std::string ca_pem   = jr.value("ca_certificate", "");
    if (cert_pem.empty()) throw std::runtime_error("No certificate in response");

    MtlsCertPaths paths;
    paths.cert_path = save_pem(cert_pem, ".pem");
    paths.key_path  = save_pem(key_pem, ".key");
    if (!ca_pem.empty()) paths.ca_path = save_pem(ca_pem, ".pem");
    LOGI("[mTLS] saved cert=%s key=%s ca=%s", paths.cert_path.c_str(), paths.key_path.c_str(), paths.ca_path.c_str());
    EVP_PKEY_free(pkey);
    return paths;
}

// ------------------ HTTP helpers ------------------
cpr::Session create_session_with_mtls(const MtlsCertPaths& mtls) {
    cpr::Session s;
    s.SetHeader({{"Content-Type", "application/json"}});
    s.SetTimeout(cpr::Timeout{10000});
    cpr::SslOptions ssl = cpr::Ssl(
        cpr::ssl::TLSv1_2{},
        cpr::ssl::VerifyPeer{!mtls.ca_path.empty()},
        cpr::ssl::CertFile{mtls.cert_path.c_str()},
        cpr::ssl::KeyFile{mtls.key_path.c_str()}
    );
    if (!mtls.ca_path.empty()) {
        ssl.SetOption(cpr::ssl::CaInfo{mtls.ca_path.c_str()});
    } else {
        ssl.SetOption(cpr::ssl::VerifyPeer{false});
    }
    s.SetSslOptions(ssl);
    return s;
}

struct ChallengeResult {
    bool ok = false;
    std::string err;
    std::string challenge;
    std::string canary;
};

ChallengeResult get_challenge(const std::string& user_key, const std::string& fingerprint, const MtlsCertPaths& mtls) {
    ChallengeResult r;
    auto s = create_session_with_mtls(mtls);
    s.SetUrl(std::string(SERVER_URL) + "/api/challenge");
    nlohmann::json body = {
        {"user_key", user_key},
        {"fingerprint", fingerprint},
        {"project_id", PROJECT_ID}
    };
    s.SetBody(cpr::Body{body.dump()});
    cpr::Response resp = s.Post();
    if (resp.status_code != 200) {
        r.err = "challenge http " + std::to_string(resp.status_code) + " err=" + resp.error.message;
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
        r.err = "challenge parse";
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

ConnectResult do_connect(const std::string& user_key,
                         const std::string& challenge,
                         const std::string& canary,
                         const std::string& fingerprint,
                         const MtlsCertPaths& mtls) {
    ConnectResult r;
    nlohmann::json data;
    data["a"] = user_key;
    data["b"] = sha256(challenge + user_key + fingerprint);
    data["c"] = canary;
    data["d"] = fingerprint;
    data["e"] = "PUBG";
    data["f"] = fingerprint.substr(0, 16);
    data["g"] = fingerprint.substr(0, 12);
    data["h"] = fingerprint.substr(0, 8);
    data["i"] = fingerprint.substr(8, 8);
    data["j"] = random_hex(16);
    data["k"] = PROJECT_ID;

    std::string blob = encryptWithMasterKey(data.dump(), MASTER_KEY_HEX);

    auto s = create_session_with_mtls(mtls);
    s.SetUrl(std::string(SERVER_URL) + "/api/connect");
    nlohmann::json body;
    body["blob"] = blob;
    body["project_id"] = PROJECT_ID;
    s.SetBody(cpr::Body{body.dump()});
    cpr::Response resp = s.Post();
    if (resp.status_code != 200) {
        r.err = "connect http " + std::to_string(resp.status_code);
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
        r.err = std::string("decrypt ") + e.what();
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

LicenseCheckResult CheckLicenseWithDetails(const char* userKey, const char* gameName, JNIEnv* env, jobject context, const char* /*caPath*/) {
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

        MtlsCertPaths mtls = fetch_or_create_mtls_cert(key);
        auto ch = get_challenge(key, fingerprint, mtls);
        if (!ch.ok) { out.error = ch.err; return out; }
        auto cn = do_connect(key, ch.challenge, ch.canary, fingerprint, mtls);
        if (!cn.ok) { out.error = cn.err; return out; }
        out.valid = true;
        out.expires_at = cn.expires_at;
        out.seconds_left = cn.seconds_left;
    } catch (const std::exception& e) {
        out.error = std::string("EXCEPTION: ") + e.what();
    }
    out.duration_ms = std::chrono::duration<double, std::milli>(std::chrono::steady_clock::now() - start).count();
    return out;
}

extern "C" JNIEXPORT jstring JNICALL
Java_com_example_myapplication_MainActivity_checkLicense(JNIEnv* env, jobject thiz, jstring jUserKey, jstring jGameName) {
    const char* userKey = env->GetStringUTFChars(jUserKey, nullptr);
    const char* gameName = env->GetStringUTFChars(jGameName, nullptr);
    LicenseCheckResult r = CheckLicenseWithDetails(userKey, gameName, env, thiz, nullptr);
    env->ReleaseStringUTFChars(jUserKey, userKey);
    env->ReleaseStringUTFChars(jGameName, gameName);
    std::string res = r.valid ? ("VALID|" + r.expires_at + "|" + r.seconds_left)
                              : ("ERROR|" + r.error);
    return env->NewStringUTF(res.c_str());
}

extern "C" const char* CheckLicense(const char* userKey, const char* gameName, JNIEnv* env, jobject context, const char* caPath) {
    static std::string res;
    auto r = CheckLicenseWithDetails(userKey, gameName, env, context, caPath);
    res = r.valid ? ("VALID|" + r.expires_at + "|" + r.seconds_left) : r.error;
    return res.c_str();
}

// No android_main/UI here. This file only provides license-checking logic.
