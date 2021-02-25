package server

import "testing"

func TestSSHAgent(t *testing.T) {
	agent, err := NewSSHAgent()
	if err != nil {
		t.Fatal(err)
	}
}
