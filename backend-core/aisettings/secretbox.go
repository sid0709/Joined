package aisettings

import (
	"crypto/aes"
	"crypto/cipher"
	"crypto/rand"
	"encoding/base64"
	"errors"
	"fmt"
)

// KeyBytes is the size of the encryption key: AES-256.
const KeyBytes = 32

// ErrNoEncryptionKey is returned when a secret has to be sealed or opened but
// SETTINGS_ENCRYPTION_KEY is not set.
var ErrNoEncryptionKey = errors.New("SETTINGS_ENCRYPTION_KEY is not set")

// Box seals secrets for storage with AES-256-GCM. A nil Box has no key: every call
// answers ErrNoEncryptionKey.
type Box struct {
	gcm cipher.AEAD
}

// NewBox builds a Box from a base64 key of KeyBytes bytes (`openssl rand -base64 32`).
// A blank key gives a nil Box.
func NewBox(encodedKey string) (*Box, error) {
	if encodedKey == "" {
		return nil, nil
	}
	key, err := base64.StdEncoding.DecodeString(encodedKey)
	if err != nil {
		return nil, fmt.Errorf("SETTINGS_ENCRYPTION_KEY is not base64: %w", err)
	}
	if len(key) != KeyBytes {
		return nil, fmt.Errorf("SETTINGS_ENCRYPTION_KEY must decode to %d bytes, got %d", KeyBytes, len(key))
	}
	block, err := aes.NewCipher(key)
	if err != nil {
		return nil, err
	}
	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return nil, err
	}
	return &Box{gcm: gcm}, nil
}

// Seal encrypts value; the result is base64 of nonce followed by ciphertext.
func (b *Box) Seal(value string) (string, error) {
	if b == nil {
		return "", ErrNoEncryptionKey
	}
	nonce := make([]byte, b.gcm.NonceSize())
	if _, err := rand.Read(nonce); err != nil {
		return "", err
	}
	return base64.StdEncoding.EncodeToString(b.gcm.Seal(nonce, nonce, []byte(value), nil)), nil
}

// Open decrypts a value Seal produced under the same key.
func (b *Box) Open(sealed string) (string, error) {
	if b == nil {
		return "", ErrNoEncryptionKey
	}
	raw, err := base64.StdEncoding.DecodeString(sealed)
	if err != nil || len(raw) < b.gcm.NonceSize() {
		return "", errors.New("stored secret is malformed")
	}
	nonce, ciphertext := raw[:b.gcm.NonceSize()], raw[b.gcm.NonceSize():]
	plain, err := b.gcm.Open(nil, nonce, ciphertext, nil)
	if err != nil {
		return "", errors.New("stored secret does not open with this SETTINGS_ENCRYPTION_KEY")
	}
	return string(plain), nil
}
