package server

import (
	"io"
	"io/ioutil"
	"net"
	"os"

	"github.com/inconshreveable/log15"
	"github.com/pkg/errors"
	"golang.org/x/crypto/ssh"
	"golang.org/x/crypto/ssh/agent"
)

type SSHAgent struct {
	l       net.Listener
	sock    string
	keyring agent.Agent
}

func NewSSHAgent(raw, passphrase []byte) (*SSHAgent, error) {
	// This does error if the passphrase is invalid, so we get immediate
	// feedback here if we screw up.
	key, err := ssh.ParseRawPrivateKeyWithPassphrase(raw, passphrase)
	if err != nil {
		return nil, errors.Wrap(err, "parsing private key")
	}

	// The keyring type implements the agent.Agent interface we need to provide
	// when serving an SSH agent. It also provides thread-safe storage for the
	// keys we provide to it. No need to reinvent the wheel!
	keyring := agent.NewKeyring()
	err = keyring.Add(agent.AddedKey{
		PrivateKey: key,
	})
	if err != nil {
		return nil, err
	}

	socketName, err := generateSocketFilename()
	if err != nil {
		return nil, err
	}

	// Start listening.
	l, err := net.Listen("unix", socketName)
	if err != nil {
		return nil, errors.Wrapf(err, "listening on socket %q", socketName)
	}

	// Set up the type we're going to return.
	a := &SSHAgent{
		l:       l,
		sock:    socketName,
		keyring: keyring,
	}
	return a, nil
}

func (a *SSHAgent) Listen() {
	for {
		// This will return when we call l.Close(), which Agent.Close() does.
		conn, err := a.l.Accept()
		if err == io.EOF {
			return
		} else if err != nil {
			log15.Error("error accepting socket connection", "err", err)
			return
		}
		log15.Error("accepted connection")

		// We don't control how SSH handles the agent, so we should handle
		// this "correctly" and spawn another goroutine, even though in
		// practice there should only ever be one connection at a time to
		// the agent.
		go func(conn net.Conn) {
			defer conn.Close()

			if err := agent.ServeAgent(a.keyring, conn); err != nil && err != io.EOF {
				log15.Error("error serving SSH agent", "err", err)
			}
		}(conn)
	}
}

func (a *SSHAgent) Close() error {
	// net.Listen() helpfully recreated the socket file for us, so we need to
	// remove it again.
	os.Remove(a.sock)

	// Close down the listener, which terminates the loop in Listen().
	return a.l.Close()
}

func (a *SSHAgent) Socket() string {
	return a.sock
}

func generateSocketFilename() (string, error) {
	// We need to set up a Unix socket. We need a temporary file.
	f, err := ioutil.TempFile(os.TempDir(), "ssh-agent-*.sock")
	if err != nil {
		return "", errors.Wrap(err, "creating temporary socket")
	}
	name := f.Name()

	// Unfortunately, the Unix socket can't exist when we call Listen, so
	// there's a potential race condition here. I don't think it's too bad in
	// practice.
	if err := f.Close(); err != nil {
		return "", errors.Wrap(err, "closing temporary socket")
	}
	if err := os.Remove(name); err != nil {
		return "", errors.Wrap(err, "removing temporary socket")
	}
	return name, nil
}
