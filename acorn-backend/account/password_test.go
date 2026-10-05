package account

import "testing"

func TestPasswordRoundTrip(t *testing.T) {
	hash, salt, err := hashPassword("correct horse")
	if err != nil {
		t.Fatal(err)
	}
	if !passwordMatches("correct horse", hash, salt) {
		t.Fatal("the password that was hashed did not match")
	}
	if passwordMatches("wrong", hash, salt) {
		t.Fatal("a different password matched")
	}
}

func TestPasswordRejectsEmptyHash(t *testing.T) {
	if passwordMatches("secret", nil, []byte("salt")) {
		t.Fatal("an empty hash matched")
	}
}
