import React, { useState, useEffect, useCallback } from 'react';
import { collection, getDocs, limit, orderBy, query } from 'firebase/firestore';
import { data } from '@/lib/data';
import { firestoreDb } from '@/lib/firebaseClient';
import type { AppSession as Session } from '../lib/data';
import Avatar from './Avatar';
import {
  STRIPE_CUSTOMER_PORTAL_LINK,
  ALL_PLANS,
  PLAN_HIERARCHY,
} from '../config';
import { ethers } from 'ethers';
import ApiKeyManager from './ApiKeyManager';
import { BusinessCustomApi } from './BusinessCustomApi';
import { listModels } from '../services/aiClient';
import { isWeb3Enabled, onWeb3FlagChange } from '../config/featureFlags';
import { loadBirthdayLocal, saveBirthdayLocal } from '../lib/onboarding';

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
    listModels()
      .then(({ isBusiness: biz }) => setIsBusiness(!!biz))
      .catch(() => setIsBusiness(false));
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
  onSetView: (
    view: 'home' | 'auth' | 'account' | 'business' | 'agency' | 'api_docs',
  ) => void;
  onSubscriptionChange: () => Promise<void>;
  navigateToPricing: () => void;
  t: (key: string) => string;
}

const Account: React.FC<AccountProps> = ({
  session,
  onSetView,
  onSubscriptionChange,
  navigateToPricing,
  t,
}) => {
  const [profileLoading, setProfileLoading] = useState(true);
  const [profileSaving, setProfileSaving] = useState(false);
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [subscriptionBusy, setSubscriptionBusy] = useState(false);
  const [web3Busy, setWeb3Busy] = useState(false);
  const [fullName, setFullName] = useState<string>('');
  const [birthDate, setBirthDate] = useState<string>('');
  const [avatarUrl, setAvatarUrl] = useState<string>('');
  const [subscriptionStatus, setSubscriptionStatus] = useState<string>('free');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [message, setMessage] = useState<{
    type: 'success' | 'error' | 'info';
    text: string;
  } | null>(null);

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

  useEffect(() => onWeb3FlagChange(setWeb3Enabled), []);

  useEffect(() => {
    getProfile();
  }, [session]);

  const syncWithBlockchain = useCallback(async () => {
    if (!walletAddress) return;

    setIsSyncing(true);
    setIsWrongNetwork(false);
    setMessage({ type: 'info', text: t('account_web3_syncing') });

    try {
      if (!(window as any).ethereum) {
        setMessage({ type: 'error', text: t('account_web3_no_wallet') });
        setIsSyncing(false);
        return;
      }

      // Ensure wallet is unlocked and connected by requesting accounts. This prevents errors on subsequent calls.
      await (window as any).ethereum.request({ method: 'eth_requestAccounts' });

      const provider = new ethers.BrowserProvider((window as any).ethereum);
      const network = await provider.getNetwork();

      if (network.chainId !== BigInt(TARGET_CHAIN_ID)) {
        setIsWrongNetwork(true);
        setMessage({
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
      const balance = await contract.balanceOf(walletAddress);

      if (balance > 0) {
        const userTokenId = await contract.getTokenIdOfOwner(walletAddress);
        const staked = await contract.isStaked(userTokenId);
        const rewards = await contract.getRewards(walletAddress);

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
      setMessage(null); // Clear info message on successful sync
    } catch (err) {
      console.error('Error syncing with blockchain:', err);
      setMessage({ type: 'error', text: t('account_web3_sync_failed') });
    } finally {
      setIsSyncing(false);
    }
  }, [walletAddress, session.user.id, t]);

  useEffect(() => {
    if (walletAddress) {
      syncWithBlockchain();
    }
  }, [walletAddress, syncWithBlockchain]);

  useEffect(() => {
    const checkEligibility = async () => {
      if (walletAddress && resumeText) {
        const analysesQuery = query(
          collection(firestoreDb, 'users', session.user.id, 'resume_analyses'),
          orderBy('created_at', 'desc'),
          limit(1),
        );
        const analysesSnapshot = await getDocs(analysesQuery);
        const latestScore = analysesSnapshot.empty
          ? 0
          : Number(analysesSnapshot.docs[0].data().score ?? 0);
        setIsEligibleForNFT(latestScore >= 85);
      } else {
        setIsEligibleForNFT(false);
      }
    };
    checkEligibility();
  }, [walletAddress, resumeText, session.user.id]);

  const getProfile = async () => {
    try {
      setProfileLoading(true);
      const { user } = session;

      const { data: profileData, error } = await data.profiles.get(user.id);

      if (error && !error.message.includes('not found')) {
        throw new Error(error.message);
      }

      if (profileData) {
        setFullName(profileData.full_name || '');
        const resolvedBirthDate = profileData.birth_date || loadBirthdayLocal(user.id);
        setBirthDate(resolvedBirthDate);
        if (resolvedBirthDate && !profileData.birth_date) {
          void data.profiles.update(user.id, {
            birth_date: resolvedBirthDate,
            updated_at: new Date().toISOString(),
          });
        }
        setAvatarUrl(profileData.avatar_url || '');
        setSubscriptionStatus(profileData.subscription_status);
        setWalletAddress(profileData.wallet_address || null);
        setNftMinted(profileData.nft_minted || false);
        setNftStaked(profileData.nft_staked || false);
        setNftEarnings(profileData.nft_earnings || 0);
        setTokenId(profileData.nft_token_id);
        setResumeText(profileData.resume_text || null);
      }
    } catch (error: any) {
      console.error('Error getting profile:', error);
      setMessage({
        type: 'error',
        text: t('account_profile_load_error'),
      });
    } finally {
      setProfileLoading(false);
    }
  };

  const updateProfile = async (
    event: React.FormEvent | null,
    { fullName, avatarUrl, birthDate }: { fullName: string; avatarUrl: string; birthDate: string },
  ) => {
    if (event) {
      event.preventDefault();
    }
    try {
      setProfileSaving(true);
      const { user } = session;

      const updates = {
        id: user.id,
        full_name: fullName,
        birth_date: birthDate || null,
        avatar_url: avatarUrl,
        updated_at: new Date().toISOString(),
      };

      const { error } = await data.profiles.upsert(updates);
      if (error) throw new Error(error.message);
      saveBirthdayLocal(user.id, birthDate);
      setMessage({
        type: 'success',
        text: t('account_profile_updated_success'),
      });
    } catch (error: any) {
      console.error('Error updating profile:', error);
      setMessage({
        type: 'error',
        text: t('account_profile_updated_error'),
      });
    } finally {
      setProfileSaving(false);
    }
  };

  const handleUpdatePassword = async (event: React.FormEvent) => {
    event.preventDefault();
    if (password !== confirmPassword) {
      setMessage({ type: 'error', text: t('account_password_mismatch_error') });
      return;
    }
    if (password.length > 0 && password.length < 6) {
      setMessage({ type: 'error', text: t('account_password_length_error') });
      return;
    }

    setPasswordSaving(true);
    const { error } = await data.auth.updatePassword(password);
    if (error) {
      setMessage({ type: 'error', text: error.message });
    } else {
      setMessage({
        type: 'success',
        text: t('account_password_updated_success'),
      });
      setPassword('');
      setConfirmPassword('');
    }
    setPasswordSaving(false);
  };

  const handleManageSubscription = async () => {
    const userLevel = PLAN_HIERARCHY[subscriptionStatus] ?? 0;
    if (userLevel > 0) {
      // Any paid plan — open the Stripe customer portal, but only when a real
      // (non-test) portal link is configured. The placeholder test link would
      // navigate the user out of the app to a dead page (mirrors the same
      // `/test_` guard the plan-purchase flow already uses).
      if (!STRIPE_CUSTOMER_PORTAL_LINK || STRIPE_CUSTOMER_PORTAL_LINK.includes('/test_')) {
        setMessage({ type: 'info', text: t('account_billing_portal_unavailable') });
        return;
      }
      setSubscriptionBusy(true);
      const portalUrl = new URL(STRIPE_CUSTOMER_PORTAL_LINK);
      if (session.user.email) {
        portalUrl.searchParams.append('prefilled_email', session.user.email);
      }
      window.location.href = portalUrl.toString();
    } else {
      navigateToPricing();
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

      setWalletAddress(address);
      setMessage({
        type: 'success',
        text: t(
          address
            ? 'account_web3_wallet_connected_success'
            : 'account_web3_wallet_disconnected_success',
        ),
      });
    } catch (error: any) {
      console.error('Error updating wallet:', error);
      setMessage({
        type: 'error',
        text: t('account_web3_wallet_update_failed'),
      });
    } finally {
      setWeb3Busy(false);
    }
  };

  const handleConnectWallet = async () => {
    if (typeof (window as any).ethereum !== 'undefined') {
      setWeb3Busy(true);
      try {
        const provider = new ethers.BrowserProvider((window as any).ethereum);
        const signer = await provider.getSigner();
        const address = await signer.getAddress();

        if (address) {
          await updateWallet(address);
        }
      } catch (error) {
        if ((error as any).code === 4001) {
          setMessage({
            type: 'error',
            text: t('account_web3_connection_rejected'),
          });
        } else {
          setMessage({ type: 'error', text: t('account_web3_connect_failed') });
          console.error(error);
        }
      } finally {
        setWeb3Busy(false);
      }
    } else {
      setMessage({ type: 'error', text: t('account_web3_no_wallet') });
    }
  };

  const handleDisconnectWallet = async () => {
    await updateWallet(null);
  };

  const handleSwitchNetwork = async () => {
    setWeb3Busy(true);
    setMessage({ type: 'info', text: t('account_web3_switch_approve') });
    try {
      await (window as any).ethereum.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: TARGET_CHAIN_ID_HEX }],
      });
      syncWithBlockchain();
    } catch (switchError: any) {
      if (switchError.code === 4902) {
        try {
          await (window as any).ethereum.request({
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
          setMessage({
            type: 'error',
            text: t('account_web3_add_network_failed'),
          });
        }
      } else {
        setMessage({ type: 'error', text: t('account_web3_switch_failed') });
      }
    } finally {
      setWeb3Busy(false);
    }
  };

  const handleMintNFT = async () => {
    if (!walletAddress) {
      setMessage({ type: 'error', text: t('account_web3_connect_first') });
      return;
    }
    setWeb3Busy(true);
    setMessage({ type: 'info', text: t('account_web3_approve_transaction') });
    try {
      const provider = new ethers.BrowserProvider((window as any).ethereum);
      const signer = await provider.getSigner();
      const contract = new ethers.Contract(
        TALENT_NFT_CONTRACT_ADDRESS,
        TALENT_NFT_ABI,
        signer,
      );

      const tx = await contract.mint(walletAddress);
      setMessage({ type: 'info', text: t('account_web3_minting_wait') });
      const receipt = await tx.wait();

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
        setMessage({
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
      setMessage({
        type: 'error',
        text: error.message || t('account_web3_mint_failed'),
      });
    } finally {
      setWeb3Busy(false);
    }
  };

  const handleToggleStake = async () => {
    if (!tokenId) return;
    setWeb3Busy(true);
    const action = nftStaked ? 'unstake' : 'stake';
    setMessage({
      type: 'info',
      text: t(
        nftStaked
          ? 'account_web3_approve_unstake'
          : 'account_web3_approve_stake',
      ),
    });
    try {
      const provider = new ethers.BrowserProvider((window as any).ethereum);
      const signer = await provider.getSigner();
      const contract = new ethers.Contract(
        TALENT_NFT_CONTRACT_ADDRESS,
        TALENT_NFT_ABI,
        signer,
      );
      const tx = await contract[action](tokenId);
      setMessage({
        type: 'info',
        text: t(
          nftStaked ? 'account_web3_unstake_wait' : 'account_web3_stake_wait',
        ),
      });
      await tx.wait();

      const newStakedStatus = !nftStaked;
      setNftStaked(newStakedStatus);
      await data.profiles.update(session.user.id, {
        nft_staked: newStakedStatus,
      });
      setMessage({
        type: 'success',
        text: t(
          newStakedStatus
            ? 'account_web3_stake_success'
            : 'account_web3_unstake_success',
        ),
      });
    } catch (error: any) {
      setMessage({
        type: 'error',
        text:
          error.message ||
          t(
            nftStaked
              ? 'account_web3_unstake_failed'
              : 'account_web3_stake_failed',
          ),
      });
    } finally {
      setWeb3Busy(false);
    }
  };

  const handleClaimRewards = async () => {
    if (!walletAddress) return;
    setWeb3Busy(true);
    setMessage({ type: 'info', text: t('account_web3_claim_approve') });
    try {
      const provider = new ethers.BrowserProvider((window as any).ethereum);
      const signer = await provider.getSigner();
      const contract = new ethers.Contract(
        TALENT_NFT_CONTRACT_ADDRESS,
        TALENT_NFT_ABI,
        signer,
      );

      const tx = await contract.claimRewards();
      setMessage({ type: 'info', text: t('account_web3_claim_wait') });
      await tx.wait();

      const rewards = await contract.getRewards(walletAddress);
      const newEarnings = parseFloat(ethers.formatEther(rewards));
      setNftEarnings(newEarnings);

      await data.profiles.update(session.user.id, {
        nft_earnings: newEarnings,
      });
      setMessage({ type: 'success', text: t('account_web3_claim_success') });
    } catch (error: any) {
      setMessage({
        type: 'error',
        text: error.message || t('account_web3_claim_failed'),
      });
    } finally {
      setWeb3Busy(false);
    }
  };

  const currentPlan = ALL_PLANS[subscriptionStatus] || ALL_PLANS.free;
  const userLevel = PLAN_HIERARCHY[subscriptionStatus] ?? 0;
  const web3ActionBusy = web3Busy || isSyncing;

  const getSubscriptionButtonText = () => {
    if (subscriptionBusy) return t('account_processing_button');
    if (userLevel === 0) return t('account_upgrade_plan_button');
    return t('account_manage_subscription_button');
  };

  return (
    <div className="max-w-3xl mx-auto bg-white dark:bg-slate-900 p-8 rounded-lg shadow-md border border-gray-200 dark:border-slate-700 animate-fade-in">
      <div className="flex justify-between items-center mb-6 pb-4 border-b dark:border-slate-700">
        <h1 className="text-3xl font-bold text-gray-800 dark:text-gray-100">
          {t('account_title')}
        </h1>
        <button
          onClick={() => onSetView('home')}
          className="text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
        >
          &larr; {t('account_back_button')}
        </button>
      </div>

      {message && (
        <div
          className={`p-4 mb-4 text-sm rounded-lg ${message.type === 'success' ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-200' : message.type === 'error' ? 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-200' : 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-200'}`}
          role="alert"
        >
          {message.text}
        </div>
      )}

      {/* Profile Details Form */}
      <form
        onSubmit={(e) => updateProfile(e, { fullName, avatarUrl, birthDate })}
        className="space-y-6"
      >
        <h2 className="text-xl font-semibold text-gray-700 dark:text-gray-300 border-b dark:border-slate-700 pb-2">
          {t('account_profile_details')}
        </h2>
        <Avatar
          url={avatarUrl}
          size={150}
          onUpload={(url) => {
            setAvatarUrl(url);
            updateProfile(null, { fullName, avatarUrl: url, birthDate });
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
            disabled={profileLoading || profileSaving}
          >
            {profileSaving
              ? t('account_saving_button')
              : t('account_update_profile_button')}
          </button>
        </div>
      </form>

      {/* API Access Section */}
      <div className="space-y-6 mt-10">
        <h2 className="text-xl font-semibold text-gray-700 dark:text-gray-300 border-b dark:border-slate-700 pb-2">
          {t('account_api_access_title')}
        </h2>
        <ApiKeyManager
          session={session}
          onViewDocs={() => onSetView('api_docs')}
        />
      </div>

      {/* Model routing is admin-controlled server-side.
            Non-business users see a muted info line; business users keep their BYOA form. */}
      <BusinessCustomApi className="mt-10 max-w-md" t={t} />
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
          <div className="bg-gray-50 dark:bg-slate-800 p-4 rounded-lg space-y-4">
            {isWrongNetwork && walletAddress ? (
              <div className="p-4 bg-yellow-100 dark:bg-yellow-900/30 border border-yellow-200 dark:border-yellow-500/30 rounded-lg text-center">
                <h3 className="font-bold text-lg text-yellow-800 dark:text-yellow-200">
                  {t('account_web3_wrong_network_title')}
                </h3>
                <p className="text-sm text-yellow-700 dark:text-yellow-300 mt-1">
                  {t('account_web3_wrong_network_desc')}
                </p>
                <button
                  onClick={handleSwitchNetwork}
                  disabled={web3ActionBusy}
                  className="mt-4 px-4 py-2 bg-yellow-500 text-white font-semibold rounded-md shadow hover:bg-yellow-600 disabled:bg-yellow-300"
                >
                  {web3ActionBusy
                    ? t('account_web3_switching_button')
                    : t('account_web3_switch_network_button')}
                </button>
              </div>
            ) : walletAddress ? (
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
                  {t('account_web3_desc_connected')}
                </p>
                <div className="flex items-center justify-between mt-2 flex-wrap gap-2">
                  <a
                    href={`https://sepolia.etherscan.io/address/${walletAddress}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-mono text-sm text-blue-600 dark:text-blue-400 hover:underline break-all"
                  >
                    {walletAddress}
                  </a>
                  <button
                    onClick={handleDisconnectWallet}
                    className="text-sm text-red-600 dark:text-red-500 hover:underline font-semibold"
                    disabled={web3ActionBusy}
                  >
                    {web3ActionBusy
                      ? '...'
                      : t('account_web3_disconnect_button')}
                  </button>
                </div>
              </div>
            ) : (
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
                  {t('account_web3_desc_unconnected')}
                </p>
                <button
                  type="button"
                  onClick={handleConnectWallet}
                  className="w-full sm:w-auto px-4 py-2 bg-gray-800 text-white font-semibold rounded-md shadow-sm hover:bg-black flex items-center justify-center gap-2"
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
              </div>
            )}

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
