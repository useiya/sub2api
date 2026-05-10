//go:build unit

package service

import (
	"context"
	"errors"
	"testing"

	"github.com/Wei-Shaw/sub2api/internal/config"
	"github.com/imroc/req/v3"
	"github.com/stretchr/testify/require"
)

func TestAdminService_EnsureOpenAIPrivacy_RetriesNonSuccessModes(t *testing.T) {
	t.Parallel()

	for _, mode := range []string{PrivacyModeFailed, PrivacyModeCFBlocked} {
		t.Run(mode, func(t *testing.T) {
			t.Parallel()

			privacyCalls := 0
			svc := &adminServiceImpl{
				accountRepo: &mockAccountRepoForGemini{},
				privacyClientFactory: func(proxyURL string) (*req.Client, error) {
					privacyCalls++
					return nil, errors.New("factory failed")
				},
			}

			account := &Account{
				ID:       101,
				Platform: PlatformOpenAI,
				Type:     AccountTypeOAuth,
				Credentials: map[string]any{
					"access_token": "token-1",
				},
				Extra: map[string]any{
					"privacy_mode": mode,
				},
			}

			got := svc.EnsureOpenAIPrivacy(context.Background(), account)

			require.Equal(t, PrivacyModeFailed, got)
			require.Equal(t, 1, privacyCalls)
		})
	}
}

type privacyRecoveryRepo struct {
	mockAccountRepoForGemini
	account         *Account
	clearErrorCalls int
}

func (r *privacyRecoveryRepo) GetByID(_ context.Context, id int64) (*Account, error) {
	if r.account != nil && r.account.ID == id {
		return r.account, nil
	}
	return nil, errors.New("account not found")
}

func (r *privacyRecoveryRepo) UpdateExtra(_ context.Context, id int64, updates map[string]any) error {
	if r.account == nil || r.account.ID != id {
		return errors.New("account not found")
	}
	if r.account.Extra == nil {
		r.account.Extra = make(map[string]any)
	}
	for key, value := range updates {
		r.account.Extra[key] = value
	}
	return nil
}

func (r *privacyRecoveryRepo) ClearError(_ context.Context, id int64) error {
	if r.account == nil || r.account.ID != id {
		return errors.New("account not found")
	}
	r.clearErrorCalls++
	r.account.Status = StatusActive
	r.account.ErrorMessage = ""
	return nil
}

func TestAdminServicePrivacySuccessClearsPrivacyRequiredError(t *testing.T) {
	t.Parallel()

	repo := &privacyRecoveryRepo{
		account: &Account{
			ID:           303,
			Platform:     PlatformOpenAI,
			Type:         AccountTypeOAuth,
			Status:       StatusError,
			ErrorMessage: "Privacy not set, required by group [default]",
			Credentials: map[string]any{
				"access_token": "token-3",
			},
		},
	}
	svc := &adminServiceImpl{accountRepo: repo}

	svc.recordPrivacyMode(context.Background(), repo.account, PrivacyModeTrainingOff)

	require.Equal(t, 1, repo.clearErrorCalls)
	require.Equal(t, StatusActive, repo.account.Status)
	require.Empty(t, repo.account.ErrorMessage)
	require.Equal(t, PrivacyModeTrainingOff, repo.account.Extra["privacy_mode"])
}

func TestAdminServicePrivacySuccessKeepsUnrelatedError(t *testing.T) {
	t.Parallel()

	repo := &privacyRecoveryRepo{
		account: &Account{
			ID:           404,
			Platform:     PlatformOpenAI,
			Type:         AccountTypeOAuth,
			Status:       StatusError,
			ErrorMessage: "rate limited",
			Credentials: map[string]any{
				"access_token": "token-4",
			},
		},
	}
	svc := &adminServiceImpl{accountRepo: repo}

	svc.recordPrivacyMode(context.Background(), repo.account, PrivacyModeTrainingOff)

	require.Zero(t, repo.clearErrorCalls)
	require.Equal(t, StatusError, repo.account.Status)
	require.Equal(t, "rate limited", repo.account.ErrorMessage)
	require.Equal(t, PrivacyModeTrainingOff, repo.account.Extra["privacy_mode"])
}

func TestTokenRefreshService_ensureOpenAIPrivacy_RetriesNonSuccessModes(t *testing.T) {
	t.Parallel()

	cfg := &config.Config{
		TokenRefresh: config.TokenRefreshConfig{
			MaxRetries:          1,
			RetryBackoffSeconds: 0,
		},
	}

	for _, mode := range []string{PrivacyModeFailed, PrivacyModeCFBlocked} {
		t.Run(mode, func(t *testing.T) {
			t.Parallel()

			service := NewTokenRefreshService(&tokenRefreshAccountRepo{}, nil, nil, nil, nil, nil, nil, cfg, nil)
			privacyCalls := 0
			service.SetPrivacyDeps(func(proxyURL string) (*req.Client, error) {
				privacyCalls++
				return nil, errors.New("factory failed")
			}, nil)

			account := &Account{
				ID:       202,
				Platform: PlatformOpenAI,
				Type:     AccountTypeOAuth,
				Credentials: map[string]any{
					"access_token": "token-2",
				},
				Extra: map[string]any{
					"privacy_mode": mode,
				},
			}

			service.ensureOpenAIPrivacy(context.Background(), account)

			require.Equal(t, 1, privacyCalls)
		})
	}
}
