import React, { useState, useEffect, useCallback, useRef } from 'react';
import { collection, getDocs, limit, orderBy, query } from 'firebase/firestore';
import { data } from '@/lib/data';
import { firestoreDb } from '@/lib/firebaseClient';
import type { AppSession as Session } from '../lib/data';
import Avatar from './Avatar';
import { ethers } from 'ethers';
import { ArrowLeft } from 'lucide-react';
// TEMP HIDDEN: user-facing API keys + BYOA custom endpoint are hidden from the
// settings page. Model/endpoint config is superadmin-only via the Admin Console.
// To restore, re-enable these imports and the two JSX blocks below.
// import ApiKeyManager from './ApiKeyManager';
// import { BusinessCustomApi } from './BusinessCustomApi';
import { listModels } from '../services/aiClient';
import { isWeb3Enabled, onWeb3FlagChange, refreshWeb3Enabled } from '../config/featureFlags';
import { loadBirthdayLocal, saveBirthdayLocal } from '../lib/onboarding';
import type { UserProfile } from '../types';

// A placeholder address for a deployed contract on a testnet (e.g., Sepolia)
const TALENT_NFT_CONTRACT_ADDRESS =
  '0x2A3b1A43842238321a22542a035921A362358189';

// The ABI for the smart contract, defining its functions and events
const TALENT_NFT_ABI = [
  'event Minted(address indexed to, uint256 indexed tokenId)',
  'event Staked(address indexed owner, uint256 indexed tokenId)',
  'event Unstaked(address indexed owner, uint256 indexed tokenId)',
  'event RewardsClaimed(address indexed to, uint256 amount)',
  'function mint(address to) external returns (uint256)',
  'function stake(uint256 tokenId) external',
  'function unstake(uint256 tokenId) external',
  'function claimRewards() external',
  'function getRewards(address account) external view returns (uint256)',
  'function isStaked(uint256 tokenId) external view returns (bool)',
  'function getTokenIdOfOwner(address owner) external view returns (uint256)',
  'function balanceOf(address owner) external view returns (uint256)',
  'function getUnlockFee() external view returns (uint256)',
];

const TARGET_CHAIN_ID = 11155111; // Sepolia Testnet Chain ID
const TARGET_CHAIN_ID_HEX = '0xaa36a7'; // Sepolia Chain ID in Hex

// The Talent NFT contract is not deployed yet (the address above is a
// placeholder), so calling it would always fail. Until a real contract is wired
// in, the credential runs in a clearly-labelled testnet PREVIEW: the wallet
// state stays saved, but mint/stake/claim are simulated locally and persisted to
// the user's nft_* profile fields instead of sending an on-chain transaction.
// Flip to false once TALENT_NFT_CONTRACT_ADDRESS points at a deployed contract.
const TALENT_NFT_PREVIEW_MODE = true;

// Deterministic per-wallet token id for the preview credential, so re-opening
// the page shows a stable id and re-mints don't churn.
const previewTokenIdFor = (address: string): number =>
  (parseInt(address.replace(/^0x/i, '').slice(0, 8) || '0', 16) % 90000) + 10000;

type AccountNotice = {
  type: 'success' | 'error' | 'info';
  text: string;
};

type EthereumProviderLike = {
  request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
};

const getEthereumProvider = (): EthereumProviderLike | null => {
  const maybe = (window as unknown as { ethereum?: EthereumProviderLike }).ethereum;
  return maybe && typeof maybe.request === 'function' ? maybe : null;
};

const normalizeWalletAddress = (address: string | null | undefined): string =>
  typeof address === 'string' ? address.trim().toLowerCase() : '';

const readConnectedWalletAccounts = async (ethereum: EthereumProviderLike): Promise<string[]> => {
  const raw = await ethereum.request({ method: 'eth_accounts' });
  return Array.isArray(raw)
    ? raw.filter((item): item is string => typeof item === 'string')
    : [];
};

const withTimeout = async <T,>(promise: Promise<T>, ms: number): Promise<T> => {
  let timeoutId: ReturnType<typeof setTimeout> | null = null;
  try {
    return await Promise.race([
      promise,
      new Promise<never>((_, reject) => {
        timeoutId = setTimeout(() => reject(new Error('Request timed out.')), ms);
      }),
    ]);
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
  }
};

const normalizeDateInput = (value: unknown): string => {
  if (!value) return '';
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed;
    const parsed = new Date(trimmed);
    return Number.isNaN(parsed.getTime()) ? '' : parsed.toISOString().slice(0, 10);
  }
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  if (typeof value === 'object' && value !== null && 'toDate' in value && typeof value.toDate === 'function') {
    return normalizeDateInput(value.toDate());
  }
  return '';
};

const accountDraftKey = (uid: string) => `account_profile_draft_${uid}`;

const loadAccountDraft = (uid: string): { fullName: string; birthDate: string } => {
  try {
    const raw = localStorage.getItem(accountDraftKey(uid));
    if (!raw) return { fullName: '', birthDate: '' };
    const draft = JSON.parse(raw) as { fullName?: unknown; birthDate?: unknown };
    return {
      fullName: typeof draft.fullName === 'string' ? draft.fullName : '',
      birthDate: normalizeDateInput(draft.birthDate),
    };
  } catch {
    return { fullName: '', birthDate: '' };
  }
};

const saveAccountDraft = (uid: string, fullName: string, birthDate: string): void => {
  try {
    localStorage.setItem(accountDraftKey(uid), JSON.stringify({ fullName, birthDate }));
  } catch {
    // Local cache is best-effort; Firestore remains the source of truth.
  }
};

const AccountNoticeBanner: React.FC<{ notice: AccountNotice | null; qa: string }> = ({ notice, qa }) => {
  if (!notice) return null;

  const toneClass = notice.type === 'success'
    ? 'border-green-200 bg-green-50 text-green-800 dark:border-green-800/50 dark:bg-green-900/25 dark:text-green-200'
    : notice.type === 'error'
      ? 'border-red-200 bg-red-50 text-red-800 dark:border-red-800/50 dark:bg-red-900/25 dark:text-red-200'
      : 'border-blue-200 bg-blue-50 text-blue-800 dark:border-blue-800/50 dark:bg-blue-900/25 dark:text-blue-200';

  return (
    <div
      className={`rounded-lg border px-3 py-2 text-sm leading-6 ${toneClass}`}
      role={notice.type === 'error' ? 'alert' : 'status'}
      aria-live={notice.type === 'error' ? 'assertive' : 'polite'}
      data-qa={qa}
    >
      {notice.text}
    </div>
  );
};

/**
 * Shown to non-business users in place of the removed model picker.
 * BusinessCustomApi (rendered just before this) renders nothing for non-business
 * users, so this note fills that slot with a one-liner instead.
 * Both components read isBusiness from listModels(); they coordinate so that
 * a business user sees only the BYOA form and a non-business user sees only this note.
 */
const ModelRoutingManagedNote: React.FC<{ t: (key: string) => string }> = ({
  t,
}) => {
  const [isBusiness, setIsBusiness] = useState<boolean | null>(null);

  useEffect(() => {
    let active = true;
    listModels()
      .then(({ isBusiness: biz }) => {
        if (active) setIsBusiness(!!biz);
      })
      .catch(() => {
        if (active) setIsBusiness(false);
      });
    return () => {
      active = false;
    };
  }, []);

  // Hide while loading or if business (BusinessCustomApi handles that case)
  if (isBusiness === null || isBusiness) return null;

  return (
    <p className="mt-6 text-xs text-gray-400 dark:text-slate-500 italic">
      {t('account_model_managed')}
    </p>
  );
};

interface AccountProps {
  session: Session;
  profile?: UserProfile | null;
  onSetView: (
    view: 'home' | 'auth' | 'account' | 'business' | 'agency' | 'api_docs',
  ) => void;
  t: (key: string) => string;
  onBack?: () => void;
}

const Account: React.FC<AccountProps> = ({
  session,
  profile,
  onSetView,
  t,
  onBack,
}) => {
  const [profileLoading, setProfileLoading] = useState(true);
  const [profileSaving, setProfileSaving] = useState(false);
  const [passwordSaving, setPasswordSaving] = useState(false);
  // False once unmounted — Account loads/saves async and is remounted on session change,
  // so a late resolve must not setState. passwordSavingRef latches a synchronous double-Enter.
  const mountedRef = useRef(true);
  const profileSavingRef = useRef(false);
  const passwordSavingRef = useRef(false);
  const web3SyncRunRef = useRef(0);
  const walletAddressRef = useRef<string | null>(null);
  const [web3Busy, setWeb3Busy] = useState(false);
  const [fullName, setFullName] = useState<string>(profile?.full_name || '');
  const [birthDate, setBirthDate] = useState<string>(normalizeDateInput(profile?.birth_date));
  const [avatarUrl, setAvatarUrl] = useState<string>(profile?.avatar_url || '');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [profileNotice, setProfileNotice] = useState<AccountNotice | null>(null);
  const [passwordNotice, setPasswordNotice] = useState<AccountNotice | null>(null);
  const [web3Notice, setWeb3Notice] = useState<AccountNotice | null>(null);

  // Web3 State
  const [walletAddress, setWalletAddress] = useState<string | null>(null);
  const [nftMinted, setNftMinted] = useState<boolean | null>(null);
  const [nftStaked, setNftStaked] = useState<boolean | null>(null);
  const [nftEarnings, setNftEarnings] = useState<number | null>(null);
  const [tokenId, setTokenId] = useState<number | null>(null);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [isEligibleForNFT, setIsEligibleForNFT] = useState(false);
  const [resumeText, setResumeText] = useState<string | null>(null);
  const [isWrongNetwork, setIsWrongNetwork] = useState(false);
  // Web3 is an experimental, admin-toggleable module — the whole section hides
  // when disabled and nothing else on this page depends on wallet state.
  const [web3Enabled, setWeb3Enabled] = useState(isWeb3Enabled());

  useEffect(() => {
    let cancelled = false;
    const unsubscribe = onWeb3FlagChange(setWeb3Enabled);
    refreshWeb3Enabled()
      .then((enabled) => { if (!cancelled) setWeb3Enabled(enabled); })
      .catch(() => { /* keep cached fallback */ });
    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, []);

  useEffect(() => {
    getProfile();
  }, [session]);

  useEffect(() => {
    if (!profile) return;
    const resolvedBirthDate = normalizeDateInput(profile.birth_date);
    setFullName(profile.full_name || '');
    setBirthDate(resolvedBirthDate);
    setAvatarUrl(profile.avatar_url || '');
    setWalletAddress(profile.wallet_address || null);
    setNftMinted(profile.nft_minted || false);
    setNftStaked(profile.nft_staked || false);
    setNftEarnings(profile.nft_earnings || 0);
    setTokenId(profile.nft_token_id);
    setResumeText(profile.resume_text || null);
    saveAccountDraft(session.user.id, profile.full_name || '', resolvedBirthDate);
  }, [profile, session.user.id]);

  useEffect(() => {
    walletAddressRef.current = walletAddress;
  }, [walletAddress]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const syncWithBlockchain = useCallback(async (options: { interactive?: boolean } = {}) => {
    if (!walletAddress) return;
    const runId = ++web3SyncRunRef.current;
    const savedAddress = walletAddress;
    const isCurrentRun = () =>
      mountedRef.current &&
      web3SyncRunRef.current === runId &&
      normalizeWalletAddress(walletAddressRef.current) === normalizeWalletAddress(savedAddress);

    setIsSyncing(true);
    setIsWrongNetwork(false);
    if (options.interactive) {
      setWeb3Notice({ type: 'info', text: t('account_web3_syncing') });
    }

    try {
      const ethereum = getEthereumProvider();
      if (!ethereum) {
        if (options.interactive) {
          setWeb3Notice({ type: 'error', text: t('account_web3_no_wallet') });
        }
        if (isCurrentRun()) setIsSyncing(false);
        return;
      }

      // Passive sync must never prompt the wallet. `eth_accounts` only returns
      // already-authorized accounts; explicit user actions request access later.
      const accounts = await readConnectedWalletAccounts(ethereum);
      if (!isCurrentRun()) return;
      const hasSavedWalletConnected = accounts.some(
        (account) => normalizeWalletAddress(account) === normalizeWalletAddress(savedAddress),
      );
      if (!hasSavedWalletConnected) {
        if (options.interactive) {
          setWeb3Notice({ type: 'error', text: t('account_web3_connect_first') });
        }
        if (isCurrentRun()) setIsSyncing(false);
        return;
      }

      if (TALENT_NFT_PREVIEW_MODE) {
        // No deployed contract yet: skip on-chain reads (they would throw and
        // wrongly wipe the credential). The wallet is connected (checked above)
        // and the nft_* values from the profile, already in local state, are the
        // source of truth. Treat the network as ready so the preview flow works
        // on any chain.
        if (isCurrentRun()) {
          setIsWrongNetwork(false);
          if (options.interactive) setWeb3Notice(null);
          setIsSyncing(false);
        }
        return;
      }

      const provider = new ethers.BrowserProvider(ethereum);
      const network = await provider.getNetwork();
      if (!isCurrentRun()) return;

      if (network.chainId !== BigInt(TARGET_CHAIN_ID)) {
        setIsWrongNetwork(true);
        setWeb3Notice({
          type: 'error',
          text: t('account_web3_wrong_network_message'),
        });
        setIsSyncing(false); // Stop syncing process
        return;
      }

      // Correct network, proceed with sync
      const contract = new ethers.Contract(
        TALENT_NFT_CONTRACT_ADDRESS,
        TALENT_NFT_ABI,
        provider,
      );
      const balance = await contract.balanceOf(savedAddress);
      if (!isCurrentRun()) return;

      if (balance > 0) {
        const userTokenId = await contract.getTokenIdOfOwner(savedAddress);
        const staked = await contract.isStaked(userTokenId);
        const rewards = await contract.getRewards(savedAddress);
        if (!isCurrentRun()) return;

        const newValues = {
          nft_minted: true,
          nft_staked: staked,
          nft_token_id: Number(userTokenId),
          nft_earnings: parseFloat(ethers.formatEther(rewards)),
        };

        setTokenId(newValues.nft_token_id);
        setNftMinted(newValues.nft_minted);
        setNftStaked(newValues.nft_staked);
        setNftEarnings(newValues.nft_earnings);

        await data.profiles.update(session.user.id, newValues);
      } else {
        const newValues = {
          nft_minted: false,
          nft_staked: false,
          nft_token_id: null,
          nft_earnings: 0,
        };

        setTokenId(newValues.nft_token_id);
        setNftMinted(newValues.nft_minted);
        setNftStaked(newValues.nft_staked);
        setNftEarnings(newValues.nft_earnings);

        await data.profiles.update(session.user.id, newValues);
      }
      if (!isCurrentRun()) return;
      setWeb3Notice(null); // Clear info message on successful sync
    } catch (err) {
      console.error('Error syncing with blockchain:', err);
      if (isCurrentRun()) {
        setWeb3Notice({ type: 'error', text: t('account_web3_sync_failed') });
      }
    } finally {
      if (isCurrentRun()) setIsSyncing(false);
    }
  }, [walletAddress, session.user.id, t]);

  useEffect(() => {
    if (walletAddress) {
      syncWithBlockchain();
    } else {
      web3SyncRunRef.current += 1;
      setIsSyncing(false);
      setIsWrongNetwork(false);
    }
  }, [walletAddress, syncWithBlockchain]);

  useEffect(() => {
    let active = true;
    const checkEligibility = async () => {
      if (walletAddress && resumeText) {
        const analysesQuery = query(
          collection(firestoreDb, 'users', session.user.id, 'resume_analyses'),
          orderBy('created_at', 'desc'),
          limit(1),
        );
        const analysesSnapshot = await getDocs(analysesQuery);
        if (!active) return;
        const latestScore = analysesSnapshot.empty
          ? 0
          : Number(analysesSnapshot.docs[0].data().score ?? 0);
        setIsEligibleForNFT(latestScore >= 85);
      } else {
        setIsEligibleForNFT(false);
      }
    };
    checkEligibility();
    return () => {
      active = false;
    };
  }, [walletAddress, resumeText, session.user.id]);

  const getProfile = async () => {
    try {
      setProfileLoading(true);
      const { user } = session;
      if (!profile) {
        const localDraft = loadAccountDraft(user.id);
        if (localDraft.fullName) setFullName(localDraft.fullName);
        if (localDraft.birthDate) setBirthDate(localDraft.birthDate);
      }

      const { data: profileData, error } = await withTimeout(data.profiles.get(user.id), 8_000);
      if (!mountedRef.current) return; // navigated away / remounted mid-load

      if (error && !error.message.includes('not found')) {
        throw new Error(error.message);
      }

      if (profileData) {
        setFullName(profileData.full_name || '');
        const resolvedBirthDate = normalizeDateInput(profileData.birth_date) || normalizeDateInput(loadBirthdayLocal(user.id));
        setBirthDate(resolvedBirthDate);
        saveAccountDraft(user.id, profileData.full_name || '', resolvedBirthDate);
        if (resolvedBirthDate && !profileData.birth_date) {
          data.profiles.update(user.id, {
            birth_date: resolvedBirthDate,
            updated_at: new Date().toISOString(),
          }).catch(() => { /* best-effort migration; the local fallback still displays */ });
        }
        setAvatarUrl(profileData.avatar_url || '');
        setWalletAddress(profileData.wallet_address || null);
        setNftMinted(profileData.nft_minted || false);
        setNftStaked(profileData.nft_staked || false);
        setNftEarnings(profileData.nft_earnings || 0);
        setTokenId(profileData.nft_token_id);
        setResumeText(profileData.resume_text || null);
      }
    } catch (error: any) {
      console.error('Error getting profile:', error);
      if (mountedRef.current) {
        setProfileNotice({
          type: 'error',
          text: t('account_profile_load_error'),
        });
      }
    } finally {
      if (mountedRef.current) setProfileLoading(false);
    }
  };

  const updateProfile = async (
    event: React.FormEvent | null,
    { fullName, avatarUrl, birthDate }: { fullName: string; avatarUrl: string; birthDate: string },
  ): Promise<boolean> => {
    if (event) {
      event.preventDefault();
    }
    if (profileSavingRef.current) return false;
    profileSavingRef.current = true;
    setProfileSaving(true);
    setProfileNotice(null);
    const { user } = session;
    const normalizedBirthDate = normalizeDateInput(birthDate);
    setFullName(fullName);
    setBirthDate(normalizedBirthDate);
    saveBirthdayLocal(user.id, normalizedBirthDate);
    saveAccountDraft(user.id, fullName, normalizedBirthDate);

    const updates = {
      id: user.id,
      full_name: fullName,
      birth_date: normalizedBirthDate || null,
      avatar_url: avatarUrl,
      updated_at: new Date().toISOString(),
    };

    try {
      const { error } = await withTimeout(data.profiles.upsert(updates), 8_000);
      if (!mountedRef.current) return false;
      if (error) throw new Error(error.message);
      setProfileNotice({
        type: 'success',
        text: t('account_profile_updated_success'),
      });
      return true;
    } catch (error) {
      console.error('Error updating profile:', error);
      if (mountedRef.current) {
        setProfileNotice({
          type: 'error',
          text: t('account_profile_updated_error'),
        });
      }
      return false;
    } finally {
      profileSavingRef.current = false;
      if (mountedRef.current) setProfileSaving(false);
    }
  };

  const handleUpdatePassword = async (event: React.FormEvent) => {
    event.preventDefault();
    if (password !== confirmPassword) {
      setPasswordNotice({ type: 'error', text: t('account_password_mismatch_error') });
      return;
    }
    if (password.length > 0 && password.length < 6) {
      setPasswordNotice({ type: 'error', text: t('account_password_length_error') });
      return;
    }

    if (passwordSavingRef.current) return; // block synchronous double-submit (a double Enter)
    passwordSavingRef.current = true;
    setPasswordSaving(true);
    setPasswordNotice(null);
    try {
      const { error } = await data.auth.updatePassword(password);
      if (!mountedRef.current) return;
      if (error) {
        setPasswordNotice({ type: 'error', text: error.message });
      } else {
        setPasswordNotice({
          type: 'success',
          text: t('account_password_updated_success'),
        });
        setPassword('');
        setConfirmPassword('');
      }
    } finally {
      passwordSavingRef.current = false;
      if (mountedRef.current) setPasswordSaving(false);
    }
  };

  const updateWallet = async (address: string | null) => {
    try {
      setWeb3Busy(true);
      const { user } = session;
      const { error } = await data.profiles.update(user.id, {
        wallet_address: address,
      });

      if (error) {
        console.error('Error updating wallet:', error);
        throw error;
      }

      if (!mountedRef.current) return;
      web3SyncRunRef.current += 1; // cancel any passive sync tied to the previous wallet
      walletAddressRef.current = address;
      setWalletAddress(address);
      setWeb3Notice({
        type: 'success',
        text: t(
          address
            ? 'account_web3_wallet_connected_success'
            : 'account_web3_wallet_disconnected_success',
        ),
      });
    } catch (error: any) {
      console.error('Error updating wallet:', error);
      if (mountedRef.current) {
        setWeb3Notice({
          type: 'error',
          text: t('account_web3_wallet_update_failed'),
        });
      }
    } finally {
      if (mountedRef.current) setWeb3Busy(false);
    }
  };

  const handleConnectWallet = async () => {
    const ethereum = getEthereumProvider();
    if (ethereum) {
      setWeb3Busy(true);
      try {
        const accounts = await ethereum.request({ method: 'eth_requestAccounts' });
        const address = Array.isArray(accounts) && typeof accounts[0] === 'string' ? accounts[0] : '';
        if (!mountedRef.current) return;

        if (address) {
          await updateWallet(address);
        } else {
          setWeb3Notice({ type: 'error', text: t('account_web3_connect_failed') });
        }
      } catch (error) {
        if (!mountedRef.current) return;
        if ((error as any).code === 4001) {
          setWeb3Notice({
            type: 'error',
            text: t('account_web3_connection_rejected'),
          });
        } else {
          setWeb3Notice({ type: 'error', text: t('account_web3_connect_failed') });
          console.error(error);
        }
      } finally {
        if (mountedRef.current) setWeb3Busy(false);
      }
    } else {
      setWeb3Notice({ type: 'error', text: t('account_web3_no_wallet') });
    }
  };

  const handleDisconnectWallet = async () => {
    await updateWallet(null);
  };

  const handleSwitchNetwork = async () => {
    const ethereum = getEthereumProvider();
    if (!ethereum) {
      setWeb3Notice({ type: 'error', text: t('account_web3_no_wallet') });
      return;
    }
    setWeb3Busy(true);
    setWeb3Notice({ type: 'info', text: t('account_web3_switch_approve') });
    try {
      await ethereum.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: TARGET_CHAIN_ID_HEX }],
      });
      if (!mountedRef.current) return;
      syncWithBlockchain({ interactive: true });
    } catch (switchError: any) {
      if (!mountedRef.current) return;
      if (switchError.code === 4902) {
        try {
          await ethereum.request({
            method: 'wallet_addEthereumChain',
            params: [
              {
                chainId: TARGET_CHAIN_ID_HEX,
                chainName: 'Sepolia',
                rpcUrls: ['https://rpc.sepolia.org'],
                nativeCurrency: {
                  name: 'Sepolia Ether',
                  symbol: 'ETH',
                  decimals: 18,
                },
                blockExplorerUrls: ['https://sepolia.etherscan.io'],
              },
            ],
          });
        } catch (addError) {
          if (!mountedRef.current) return;
          setWeb3Notice({
            type: 'error',
            text: t('account_web3_add_network_failed'),
          });
        }
      } else {
        setWeb3Notice({ type: 'error', text: t('account_web3_switch_failed') });
      }
    } finally {
      if (mountedRef.current) setWeb3Busy(false);
    }
  };

  const getWeb3ActionErrorText = (error: unknown, fallbackKey: string): string => {
    const code = typeof error === 'object' && error !== null && 'code' in error
      ? (error as { code?: unknown }).code
      : undefined;
    if (code === 4001 || code === 'ACTION_REJECTED') {
      return t('account_web3_connection_rejected');
    }
    return t(fallbackKey);
  };

  const getSignerForSavedWallet = async (): Promise<ethers.JsonRpcSigner | null> => {
    if (!walletAddress) {
      setWeb3Notice({ type: 'error', text: t('account_web3_connect_first') });
      return null;
    }

    const ethereum = getEthereumProvider();
    if (!ethereum) {
      setWeb3Notice({ type: 'error', text: t('account_web3_no_wallet') });
      return null;
    }

    try {
      const accounts = await ethereum.request({ method: 'eth_requestAccounts' });
      const activeAddress = Array.isArray(accounts) && typeof accounts[0] === 'string'
        ? accounts[0]
        : '';

      if (!mountedRef.current) return null;

      if (!activeAddress) {
        setWeb3Notice({ type: 'error', text: t('account_web3_connect_failed') });
        return null;
      }

      if (normalizeWalletAddress(activeAddress) !== normalizeWalletAddress(walletAddress)) {
        setWeb3Notice({ type: 'error', text: t('account_web3_connect_first') });
        return null;
      }

      const provider = new ethers.BrowserProvider(ethereum);
      return provider.getSigner();
    } catch (error) {
      if (mountedRef.current) {
        setWeb3Notice({
          type: 'error',
          text: getWeb3ActionErrorText(error, 'account_web3_connect_failed'),
        });
      }
      return null;
    }
  };

  const handleMintNFT = async () => {
    if (!walletAddress) {
      setWeb3Notice({ type: 'error', text: t('account_web3_connect_first') });
      return;
    }
    setWeb3Busy(true);
    if (TALENT_NFT_PREVIEW_MODE) {
      setWeb3Notice({ type: 'info', text: t('account_web3_minting_wait') });
      const prevTokenId = tokenId;
      const prevMinted = nftMinted;
      try {
        const newTokenId = previewTokenIdFor(walletAddress);
        setTokenId(newTokenId);
        setNftMinted(true);
        await data.profiles.update(session.user.id, {
          nft_minted: true,
          nft_token_id: newTokenId,
        });
        if (!mountedRef.current) return;
        setWeb3Notice({
          type: 'success',
          text: t('account_web3_mint_success').replace('{id}', String(newTokenId)),
        });
      } catch (error: any) {
        if (mountedRef.current) {
          setTokenId(prevTokenId);
          setNftMinted(prevMinted);
          setWeb3Notice({
            type: 'error',
            text: getWeb3ActionErrorText(error, 'account_web3_mint_failed'),
          });
        }
      } finally {
        if (mountedRef.current) setWeb3Busy(false);
      }
      return;
    }
    setWeb3Notice({ type: 'info', text: t('account_web3_approve_transaction') });
    try {
      const signer = await getSignerForSavedWallet();
      if (!signer || !mountedRef.current) return;
      const contract = new ethers.Contract(
        TALENT_NFT_CONTRACT_ADDRESS,
        TALENT_NFT_ABI,
        signer,
      );

      const tx = await contract.mint(walletAddress);
      if (!mountedRef.current) return;
      setWeb3Notice({ type: 'info', text: t('account_web3_minting_wait') });
      const receipt = await tx.wait();
      if (!mountedRef.current) return;

      const mintEvent = receipt.logs.find((log: any) => {
        try {
          const p = contract.interface.parseLog(log);
          return p?.name === 'Minted';
        } catch (e) {
          return false;
        }
      });

      if (mintEvent) {
        const parsedLog = contract.interface.parseLog(mintEvent);
        const newTokenId = Number(parsedLog.args.tokenId);
        setTokenId(newTokenId);
        setNftMinted(true);
        await data.profiles.update(session.user.id, {
          nft_minted: true,
          nft_token_id: newTokenId,
        });
        if (!mountedRef.current) return;
        setWeb3Notice({
          type: 'success',
          text: t('account_web3_mint_success').replace(
            '{id}',
            String(newTokenId),
          ),
        });
      } else {
        throw new Error(t('account_web3_mint_missing_event'));
      }
    } catch (error: any) {
      if (mountedRef.current) {
        setWeb3Notice({
          type: 'error',
          text: getWeb3ActionErrorText(error, 'account_web3_mint_failed'),
        });
      }
    } finally {
      if (mountedRef.current) setWeb3Busy(false);
    }
  };

  const handleToggleStake = async () => {
    if (tokenId === null) return;
    setWeb3Busy(true);
    const newStakedStatus = !nftStaked;
    if (TALENT_NFT_PREVIEW_MODE) {
      const prevStaked = nftStaked;
      const prevEarnings = nftEarnings;
      setWeb3Notice({
        type: 'info',
        text: t(nftStaked ? 'account_web3_unstake_wait' : 'account_web3_stake_wait'),
      });
      try {
        const updates: Record<string, unknown> = { nft_staked: newStakedStatus };
        setNftStaked(newStakedStatus);
        // Preview: activating in the talent pool accrues a sample reward so the
        // claim step is demonstrable without waiting for real on-chain accrual.
        if (newStakedStatus && (nftEarnings ?? 0) <= 0) {
          updates.nft_earnings = 0.05;
          setNftEarnings(0.05);
        }
        await data.profiles.update(session.user.id, updates);
        if (!mountedRef.current) return;
        setWeb3Notice({
          type: 'success',
          text: t(newStakedStatus ? 'account_web3_stake_success' : 'account_web3_unstake_success'),
        });
      } catch (error: any) {
        if (mountedRef.current) {
          setNftStaked(prevStaked);
          setNftEarnings(prevEarnings);
          setWeb3Notice({
            type: 'error',
            text: getWeb3ActionErrorText(
              error,
              nftStaked ? 'account_web3_unstake_failed' : 'account_web3_stake_failed',
            ),
          });
        }
      } finally {
        if (mountedRef.current) setWeb3Busy(false);
      }
      return;
    }
    const action = nftStaked ? 'unstake' : 'stake';
    setWeb3Notice({
      type: 'info',
      text: t(
        nftStaked
          ? 'account_web3_approve_unstake'
          : 'account_web3_approve_stake',
      ),
    });
    try {
      const signer = await getSignerForSavedWallet();
      if (!signer || !mountedRef.current) return;
      const contract = new ethers.Contract(
        TALENT_NFT_CONTRACT_ADDRESS,
        TALENT_NFT_ABI,
        signer,
      );
      const tx = await contract[action](tokenId);
      if (!mountedRef.current) return;
      setWeb3Notice({
        type: 'info',
        text: t(
          nftStaked ? 'account_web3_unstake_wait' : 'account_web3_stake_wait',
        ),
      });
      await tx.wait();
      if (!mountedRef.current) return;

      setNftStaked(newStakedStatus);
      await data.profiles.update(session.user.id, {
        nft_staked: newStakedStatus,
      });
      if (!mountedRef.current) return;
      setWeb3Notice({
        type: 'success',
        text: t(
          newStakedStatus
            ? 'account_web3_stake_success'
            : 'account_web3_unstake_success',
        ),
      });
    } catch (error: any) {
      if (mountedRef.current) {
        setWeb3Notice({
          type: 'error',
          text: getWeb3ActionErrorText(
            error,
            nftStaked
              ? 'account_web3_unstake_failed'
              : 'account_web3_stake_failed',
          ),
        });
      }
    } finally {
      if (mountedRef.current) setWeb3Busy(false);
    }
  };

  const handleClaimRewards = async () => {
    if (!walletAddress) {
      setWeb3Notice({ type: 'error', text: t('account_web3_connect_first') });
      return;
    }
    setWeb3Busy(true);
    if (TALENT_NFT_PREVIEW_MODE) {
      setWeb3Notice({ type: 'info', text: t('account_web3_claim_wait') });
      const prevEarnings = nftEarnings;
      try {
        // Preview rewards accrue only while the credential is staked.
        const reward = nftStaked ? 0.05 : 0;
        const newEarnings = Number(((nftEarnings ?? 0) + reward).toFixed(4));
        setNftEarnings(newEarnings);
        await data.profiles.update(session.user.id, { nft_earnings: newEarnings });
        if (!mountedRef.current) return;
        setWeb3Notice({ type: 'success', text: t('account_web3_claim_success') });
      } catch (error: any) {
        if (mountedRef.current) {
          setNftEarnings(prevEarnings);
          setWeb3Notice({
            type: 'error',
            text: getWeb3ActionErrorText(error, 'account_web3_claim_failed'),
          });
        }
      } finally {
        if (mountedRef.current) setWeb3Busy(false);
      }
      return;
    }
    setWeb3Notice({ type: 'info', text: t('account_web3_claim_approve') });
    try {
      const signer = await getSignerForSavedWallet();
      if (!signer || !mountedRef.current) return;
      const contract = new ethers.Contract(
        TALENT_NFT_CONTRACT_ADDRESS,
        TALENT_NFT_ABI,
        signer,
      );

      const tx = await contract.claimRewards();
      if (!mountedRef.current) return;
      setWeb3Notice({ type: 'info', text: t('account_web3_claim_wait') });
      await tx.wait();
      if (!mountedRef.current) return;

      const rewards = await contract.getRewards(walletAddress);
      const newEarnings = parseFloat(ethers.formatEther(rewards));
      if (!mountedRef.current) return;
      setNftEarnings(newEarnings);

      await data.profiles.update(session.user.id, {
        nft_earnings: newEarnings,
      });
      if (!mountedRef.current) return;
      setWeb3Notice({ type: 'success', text: t('account_web3_claim_success') });
    } catch (error: any) {
      if (mountedRef.current) {
        setWeb3Notice({
          type: 'error',
          text: getWeb3ActionErrorText(error, 'account_web3_claim_failed'),
        });
      }
    } finally {
      if (mountedRef.current) setWeb3Busy(false);
    }
  };

  const web3ActionBusy = web3Busy || isSyncing;
  const hasWallet = Boolean(walletAddress);
  const hasCredential = Boolean(nftMinted);
  const web3NextStep = isSyncing
    ? t('account_web3_syncing')
    : !hasWallet
      ? t('account_web3_next_connect')
      : isWrongNetwork
        ? t('account_web3_next_switch')
        : hasCredential
          ? t('account_web3_next_active')
          : isEligibleForNFT
            ? t('account_web3_next_mint')
            : t('account_web3_next_improve');
  const web3StatusItems: Array<{
    label: string;
    value: string;
    tone: 'done' | 'attention' | 'pending';
  }> = [
    {
      label: t('account_web3_status_wallet'),
      value: hasWallet
        ? t('account_web3_status_connected')
        : t('account_web3_status_not_connected'),
      tone: hasWallet ? 'done' : 'pending',
    },
    {
      label: t('account_web3_status_network'),
      value: !hasWallet
        ? t('account_web3_status_waiting')
        : isWrongNetwork
          ? t('account_web3_status_wrong_network')
          : t('account_web3_status_ready'),
      tone: !hasWallet ? 'pending' : isWrongNetwork ? 'attention' : 'done',
    },
    {
      label: t('account_web3_status_credential'),
      value: hasCredential
        ? t('account_web3_status_minted')
        : isEligibleForNFT
          ? t('account_web3_status_eligible')
          : t('account_web3_status_not_eligible'),
      tone: hasCredential ? 'done' : isEligibleForNFT ? 'attention' : 'pending',
    },
  ];
  const web3ToneClass = (tone: 'done' | 'attention' | 'pending') => {
    if (tone === 'done') {
      return 'border-green-200 bg-green-50 text-green-800 dark:border-green-800/50 dark:bg-green-900/20 dark:text-green-200';
    }
    if (tone === 'attention') {
      return 'border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-800/50 dark:bg-amber-900/20 dark:text-amber-200';
    }
    return 'border-gray-200 bg-gray-50 text-gray-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300';
  };

  return (
    <div className="max-w-3xl mx-auto bg-white dark:bg-slate-900 p-8 rounded-lg shadow-md border border-gray-200 dark:border-slate-700 animate-fade-in">
      <div className="flex justify-between items-center mb-6 pb-4 border-b dark:border-slate-700">
        <h1 className="text-3xl font-bold text-gray-800 dark:text-gray-100">
          {t('account_title')}
        </h1>
        <button
          type="button"
          onClick={onBack ?? (() => onSetView('home'))}
          className="inline-flex items-center gap-2 rounded-full border border-gray-200 bg-white px-3 py-1.5 text-sm font-semibold text-gray-600 shadow-sm transition-colors hover:bg-gray-50 hover:text-gray-950 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white"
        >
          <ArrowLeft className="h-4 w-4" />
          {t('account_back_button')}
        </button>
      </div>

      {/* Profile Details Form */}
      <form
        onSubmit={(e) => updateProfile(e, { fullName, avatarUrl, birthDate })}
        className="space-y-6"
      >
        <h2 className="text-xl font-semibold text-gray-700 dark:text-gray-300 border-b dark:border-slate-700 pb-2">
          {t('account_profile_details')}
        </h2>
        <AccountNoticeBanner notice={profileNotice} qa="account-profile-notice" />
        <Avatar
          url={avatarUrl}
          size={150}
          onUpload={async (url) => {
            const prev = avatarUrl;
            setAvatarUrl(url);
            const ok = await updateProfile(null, { fullName, avatarUrl: url, birthDate });
            // Save failed — revert the preview so we don't show an image that didn't persist.
            if (!ok && mountedRef.current) setAvatarUrl(prev);
          }}
          altText={t('ws_profile_avatar_alt')}
          uploadLabel={t('account_avatar_upload')}
          uploadingLabel={t('account_avatar_uploading')}
          selectImageMessage={t('account_avatar_select_required')}
          signInRequiredMessage={t('account_avatar_signin_required')}
          maxSizeMessage={t('account_avatar_size_error')}
          timeoutMessage={t('account_avatar_timeout_error')}
        />
        <div>
          <label
            htmlFor="email"
            className="block text-sm font-medium text-gray-700 dark:text-gray-300"
          >
            {t('account_email_label')}
          </label>
          <input
            id="email"
            type="text"
            value={session.user.email || ''}
            disabled
            className="mt-1 block w-full bg-gray-100 dark:bg-slate-800 border border-gray-300 dark:border-slate-600 rounded-md shadow-sm py-2 px-3 focus:outline-none"
          />
        </div>
        <div>
          <label
            htmlFor="fullName"
            className="block text-sm font-medium text-gray-700 dark:text-gray-300"
          >
            {t('account_fullname_label')}
          </label>
          <input
            id="fullName"
            type="text"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            className="mt-1 block w-full border border-gray-300 dark:border-slate-600 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-slate-900"
          />
        </div>
        <div>
          <label
            htmlFor="birthDate"
            className="block text-sm font-medium text-gray-700 dark:text-gray-300"
          >
            {t('account_birth_date_label')}
          </label>
          <input
            id="birthDate"
            type="date"
            value={birthDate}
            max={new Date().toISOString().slice(0, 10)}
            onChange={(e) => setBirthDate(e.target.value)}
            className="mt-1 block w-full border border-gray-300 dark:border-slate-600 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-slate-900"
          />
          <p className="mt-1 text-xs text-gray-500 dark:text-slate-400">{t('account_birth_date_hint')}</p>
        </div>
        <div>
          <button
            type="submit"
            className="w-full sm:w-auto px-4 py-2 bg-blue-700 text-white font-semibold rounded-md shadow-sm hover:bg-blue-800 disabled:bg-blue-400"
            disabled={profileSaving}
          >
            {profileSaving
              ? t('account_saving_button')
              : t('account_update_profile_button')}
          </button>
        </div>
      </form>

      {/* TEMP HIDDEN: API Access (user API keys) — config is superadmin-only
          via the Admin Console. Restore by uncommenting this block + the import.
      <div className="space-y-6 mt-10">
        <h2 className="text-xl font-semibold text-gray-700 dark:text-gray-300 border-b dark:border-slate-700 pb-2">
          {t('account_api_access_title')}
        </h2>
        <ApiKeyManager
          session={session}
          onViewDocs={() => onSetView('api_docs')}
        />
      </div>
      */}

      {/* TEMP HIDDEN: BYOA custom endpoint — not part of our model right now.
          Restore by uncommenting this line + the import.
      <BusinessCustomApi className="mt-10 max-w-md" t={t} />
      */}

      {/* Model routing is admin-controlled server-side.
            Non-business users see a muted info line. */}
      <ModelRoutingManagedNote t={t} />

      {/* Web3 Identity Section — experimental, feature-flagged */}
      {web3Enabled && (
        <div className="space-y-6 mt-10">
          <div className="flex items-center gap-2 border-b dark:border-slate-700 pb-2">
            <h2 className="text-xl font-semibold text-gray-700 dark:text-gray-300">
              {t('account_web3_title')}
            </h2>
            <span className="inline-block rounded-full border border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-900/30 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-amber-700 dark:text-amber-300">
              {t('account_web3_experimental_badge')}
            </span>
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400 -mt-3">
            {t('account_web3_optional_note')}
          </p>
          {TALENT_NFT_PREVIEW_MODE && (
            <div
              className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:border-amber-800/50 dark:bg-amber-900/20 dark:text-amber-200"
              role="note"
            >
              <span
                aria-hidden="true"
                className="mt-0.5 inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full border border-amber-300 text-[10px] font-bold"
              >
                i
              </span>
              <span>{t('account_web3_preview_notice')}</span>
            </div>
          )}
          <AccountNoticeBanner notice={web3Notice} qa="account-web3-notice" />
          <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4 shadow-sm dark:border-slate-700 dark:bg-slate-800/70 space-y-4">
            <div className="rounded-xl border border-gray-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                    {hasWallet
                      ? t('account_web3_desc_connected')
                      : t('account_web3_desc_unconnected')}
                  </p>
                  {walletAddress && (
                    <a
                      href={`https://sepolia.etherscan.io/address/${walletAddress}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-2 block break-all font-mono text-xs text-blue-600 hover:underline dark:text-blue-400"
                    >
                      {walletAddress}
                    </a>
                  )}
                </div>

                <div className="flex shrink-0 flex-wrap gap-2">
                  {!hasWallet ? (
                    <button
                      type="button"
                      onClick={handleConnectWallet}
                      className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-gray-900 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-black disabled:bg-gray-400 sm:w-auto dark:bg-blue-600 dark:hover:bg-blue-500"
                      disabled={web3ActionBusy}
                    >
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        className="h-5 w-5"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"
                        />
                      </svg>
                      {t('account_web3_connect_button')}
                    </button>
                  ) : isWrongNetwork ? (
                    <button
                      type="button"
                      onClick={handleSwitchNetwork}
                      disabled={web3ActionBusy}
                      className="inline-flex w-full items-center justify-center rounded-lg bg-amber-500 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-amber-600 disabled:bg-amber-300 sm:w-auto"
                    >
                      {web3ActionBusy
                        ? t('account_web3_switching_button')
                        : t('account_web3_switch_network_button')}
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={handleDisconnectWallet}
                      className="inline-flex w-full items-center justify-center rounded-lg border border-red-200 bg-white px-4 py-2 text-sm font-semibold text-red-600 transition-colors hover:bg-red-50 disabled:opacity-60 sm:w-auto dark:border-red-900/60 dark:bg-slate-900 dark:text-red-300 dark:hover:bg-red-950/30"
                      disabled={web3ActionBusy}
                    >
                      {web3ActionBusy ? '...' : t('account_web3_disconnect_button')}
                    </button>
                  )}
                </div>
              </div>

              <div className="mt-4 grid gap-2 sm:grid-cols-3">
                {web3StatusItems.map((item) => (
                  <div
                    key={item.label}
                    className={`rounded-xl border px-3 py-2 ${web3ToneClass(item.tone)}`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[11px] font-bold uppercase tracking-wide opacity-75">
                        {item.label}
                      </span>
                      <span aria-hidden="true" className="text-sm font-bold">
                        {item.tone === 'done' ? '✓' : item.tone === 'attention' ? '!' : '·'}
                      </span>
                    </div>
                    <p className="mt-1 text-sm font-semibold">{item.value}</p>
                  </div>
                ))}
              </div>

              <div className="mt-4 rounded-xl border border-blue-100 bg-blue-50 px-3 py-2 text-sm text-blue-900 dark:border-blue-900/50 dark:bg-blue-950/30 dark:text-blue-100">
                <span className="font-semibold">{t('account_web3_next_step_label')}:</span>{' '}
                {web3NextStep}
              </div>
            </div>

            {isEligibleForNFT &&
              !nftMinted &&
              !isWrongNetwork &&
              walletAddress && (
                <div className="p-4 bg-blue-100 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-500/30 rounded-lg text-center animate-fade-in">
                  <h3 className="font-bold text-lg text-blue-800 dark:text-blue-200">
                    {t('account_web3_nft_eligible_title')}
                  </h3>
                  <p className="text-sm text-blue-700 dark:text-blue-300 mt-1">
                    {t('account_web3_nft_eligible_desc')}
                  </p>
                  <button
                    onClick={handleMintNFT}
                    disabled={web3ActionBusy}
                    className="mt-4 px-4 py-2 bg-blue-600 text-white font-semibold rounded-md shadow hover:bg-blue-700 disabled:bg-blue-400"
                  >
                    {web3Busy
                      ? t('account_web3_nft_minting_button')
                      : t('account_web3_nft_mint_button')}
                  </button>
                </div>
              )}

            {nftMinted && !isWrongNetwork && walletAddress && (
              <div className="p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-700/50 rounded-lg animate-fade-in space-y-4">
                <h3 className="font-bold text-lg text-green-800 dark:text-green-200 text-center">
                  {t('account_web3_your_nft')}
                </h3>

                <div className="group relative w-full max-w-sm mx-auto p-1 rounded-2xl bg-gradient-to-br from-blue-500 via-cyan-400 to-green-400 transition-transform duration-300 hover:-translate-y-2 [transform-style:preserve-3d] hover:[transform:perspective(800px)_rotateY(10deg)_translateY(-0.5rem)]">
                  <div className="relative bg-gray-900 rounded-xl p-6 h-full text-white overflow-hidden [transform:translateZ(40px)]">
                    <div className="absolute inset-0 -z-10 opacity-30 [background-image:radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-blue-500 via-transparent to-transparent [background-size:1000%_1000%] animate-aurora"></div>
                    <div className="flex justify-between items-center">
                      <span className="text-xs font-bold tracking-widest uppercase text-cyan-300">
                        Proof-of-Talent
                      </span>
                      <span className="text-xs font-mono text-gray-400">
                        ID: #{tokenId}
                      </span>
                    </div>

                    <div className="my-8 flex justify-center items-center">
                      <svg
                        width="80"
                        height="80"
                        viewBox="0 0 100 100"
                        xmlns="http://www.w3.org/2000/svg"
                        className="drop-shadow-[0_0_10px_rgba(0,190,255,0.7)]"
                      >
                        <defs>
                          <linearGradient
                            id="crystal-grad"
                            x1="0%"
                            y1="0%"
                            x2="100%"
                            y2="100%"
                          >
                            <stop offset="0%" stopColor="#00d1ff" />
                            <stop offset="100%" stopColor="#00ffc4" />
                          </linearGradient>
                          <filter id="glow">
                            <feGaussianBlur
                              stdDeviation="3.5"
                              result="coloredBlur"
                            />
                            <feMerge>
                              <feMergeNode in="coloredBlur" />
                              <feMergeNode in="SourceGraphic" />
                            </feMerge>
                          </filter>
                        </defs>
                        <g filter="url(#glow)" className="animate-pulse-glow">
                          <path
                            d="M50 2 L98 50 L50 98 L2 50 Z"
                            fill="rgba(0,255,196,0.1)"
                            stroke="url(#crystal-grad)"
                            strokeWidth="1"
                          />
                          <path
                            d="M50 2 L74 26 L50 50 L26 26 Z"
                            fill="rgba(0,209,255,0.2)"
                          />
                          <path
                            d="M50 98 L74 74 L50 50 L26 74 Z"
                            fill="rgba(0,209,255,0.2)"
                          />
                          <path
                            d="M2 50 L26 26 L50 50 L26 74 Z"
                            fill="rgba(0,255,196,0.2)"
                          />
                          <path
                            d="M98 50 L74 26 L50 50 L74 74 Z"
                            fill="rgba(0,255,196,0.2)"
                          />
                        </g>
                      </svg>
                    </div>

                    <div className="text-center">
                      <h4 className="text-2xl font-semibold tracking-wide bg-gradient-to-r from-gray-200 via-cyan-300 to-gray-200 bg-clip-text text-transparent [background-size:200%_auto] animate-holographic-text">
                        {fullName}
                      </h4>
                      <p className="text-sm text-cyan-400 mt-1">
                        {t('account_web3_verified_candidate')}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between bg-white dark:bg-slate-700/50 p-3 rounded-md">
                  <div>
                    <label
                      htmlFor="stake-toggle"
                      className="font-semibold text-gray-800 dark:text-gray-200"
                    >
                      {t('account_web3_stake_label')}
                    </label>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      {t('account_web3_stake_desc')}
                    </p>
                  </div>
                  <button
                    id="stake-toggle"
                    onClick={handleToggleStake}
                    disabled={web3ActionBusy}
                    className={`relative inline-flex items-center h-6 rounded-full w-11 transition-colors ${nftStaked ? 'bg-blue-600' : 'bg-gray-300 dark:bg-slate-600'}`}
                  >
                    <span
                      className={`inline-block w-4 h-4 transform bg-white rounded-full transition-transform ${nftStaked ? 'translate-x-6' : 'translate-x-1'}`}
                    />
                  </button>
                </div>
                <div className="text-center pt-2">
                  <h4 className="font-semibold text-gray-800 dark:text-gray-200">
                    {t('account_web3_earnings_title')}
                  </h4>
                  <p className="text-3xl font-bold text-green-600 dark:text-green-500 mt-1">
                    {(nftEarnings || 0).toFixed(4)} ETH
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    {t('account_web3_earnings_desc')}
                  </p>
                  {nftEarnings && nftEarnings > 0 && (
                    <button
                      onClick={handleClaimRewards}
                      disabled={web3ActionBusy}
                      className="mt-2 text-sm bg-green-100 text-green-800 font-semibold px-3 py-1 rounded-full hover:bg-green-200 disabled:opacity-50"
                    >
                      {web3Busy
                        ? t('account_web3_claiming_button')
                        : t('account_web3_claim_rewards_button')}
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      <form onSubmit={handleUpdatePassword} className="space-y-6 mt-10">
        <h2 className="text-xl font-semibold text-gray-700 dark:text-gray-300 border-b dark:border-slate-700 pb-2">
          {t('account_change_password')}
        </h2>
        <AccountNoticeBanner notice={passwordNotice} qa="account-password-notice" />
        <div>
          <label
            htmlFor="newPassword"
            className="block text-sm font-medium text-gray-700 dark:text-gray-300"
          >
            {t('account_new_password_label')}
          </label>
          <input
            id="newPassword"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="mt-1 block w-full border border-gray-300 dark:border-slate-600 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-slate-900"
            placeholder="••••••••"
          />
        </div>
        <div>
          <label
            htmlFor="confirmPassword"
            className="block text-sm font-medium text-gray-700 dark:text-gray-300"
          >
            {t('account_confirm_password_label')}
          </label>
          <input
            id="confirmPassword"
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            className="mt-1 block w-full border border-gray-300 dark:border-slate-600 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-slate-900"
            placeholder="••••••••"
          />
        </div>
        <div>
          <button
            type="submit"
            className="w-full sm:w-auto px-4 py-2 bg-gray-700 text-white font-semibold rounded-md shadow-sm hover:bg-gray-800 disabled:bg-gray-400"
            disabled={passwordSaving || !password}
          >
            {passwordSaving
              ? t('account_saving_button')
              : t('account_update_password_button')}
          </button>
        </div>
      </form>

      {/* Subscription / plan management lives on the dedicated "Billing & Plan"
          page (sidebar) — removed here to avoid a redundant second entry point. */}
    </div>
  );
};

export default Account;
