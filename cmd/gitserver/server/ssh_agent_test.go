package server

import (
	"fmt"
	"net"
	"testing"
	"time"

	"golang.org/x/crypto/ssh"
	"golang.org/x/crypto/ssh/agent"

	"github.com/sourcegraph/sourcegraph/internal/encryption"
)

func TestSSHAgent(t *testing.T) {
	keypair, err := encryption.GenerateRSAKey()
	if err != nil {
		t.Fatal(err)
	}

	// Spawn the agent using the keypair from above.
	a, err := NewSSHAgent([]byte(keypair.PrivateKey), []byte(keypair.Passphrase))
	if err != nil {
		t.Fatal(err)
	}
	go a.Listen()
	defer a.Close()

	// Spawn an ssh server which will accept the public key from the keypair.
	serverConfig := &ssh.ServerConfig{
		PublicKeyCallback: func(c ssh.ConnMetadata, pubKey ssh.PublicKey) (*ssh.Permissions, error) {
			t.Log("ATTEMPTED TO AUTHENTICATE")
			if string(pubKey.Marshal()) == keypair.PublicKey {
				return &ssh.Permissions{
					// Record the public key used for authentication.
					Extensions: map[string]string{
						"pubkey-fp": ssh.FingerprintSHA256(pubKey),
					},
				}, nil
			}
			return nil, fmt.Errorf("unknown public key for %q", c.User())
		},
	}
	serverKey, err := encryption.GenerateRSAKey()
	if err != nil {
		t.Fatal(err)
	}
	decryptedServerKey, err := ssh.ParsePrivateKeyWithPassphrase([]byte(serverKey.PrivateKey), []byte(serverKey.Passphrase))
	if err != nil {
		t.Fatal(err)
	}
	serverConfig.AddHostKey(decryptedServerKey)
	listener, err := net.Listen("tcp", "0.0.0.0:2022")
	if err != nil {
		t.Fatal(err)
	}
	errs := make(chan error)
	go func() {
		nConn, err := listener.Accept()
		if err != nil {
			errs <- err
			return
		}
		defer nConn.Close()
		conn, chans, reqs, err := ssh.NewServerConn(nConn, serverConfig)
		if err != nil {
			errs <- err
			return
		}
		defer conn.Close()
		go ssh.DiscardRequests(reqs)
		for newChannel := range chans {
			channel, _, err := newChannel.Accept()
			if err != nil {
				errs <- err
				return
			}
			channel.Close()
		}
	}()
	time.Sleep(1 * time.Hour)

	// Now try to connect to that server using the private key from the keypair.
	clientConn, err := net.Dial("tcp", "0.0.0.0:2022")
	if err != nil {
		t.Fatal(err)
	}
	clientConfig := &ssh.ClientConfig{
		HostKeyCallback: ssh.InsecureIgnoreHostKey(),
		Auth:            []ssh.AuthMethod{ssh.PublicKeys()},
	}
	conn, ch, reqs, err := ssh.NewClientConn(clientConn, "0.0.0.0:2022", clientConfig)
	if err != nil {
		t.Fatal(err)
	}
	sClient := ssh.NewClient(conn, ch, reqs)
	if err := agent.ForwardToRemote(sClient, a.Socket()); err != nil {
		t.Fatal(err)
	}
	sess, err := sClient.NewSession()
	if err != nil {
		t.Fatal(err)
	}
	sess.Output("test")
	select {
	case err := <-errs:
		t.Fatal(err)
	}
}
