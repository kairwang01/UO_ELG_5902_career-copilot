import React, { useState } from 'react';
import type { UserProfile } from '../types';
import { ethers } from 'ethers';

interface MatchedCandidate extends UserProfile {
    compatibilityScore: number;
    summary: string;
}

interface UnlockTalentModalProps {
    candidate: MatchedCandidate & { index: number };
    canUnlock: boolean;
    onClose: () => void;
    onUnlocked: (candidate: MatchedCandidate & { index: number }) => void;
    navigateToBusinessPricing: () => void;
    t: (key: string) => string;
}

// NOTE: In a real app, this would be in a shared constants file.
// A placeholder address for a deployed contract on a testnet (e.g., Sepolia)
const TALENT_NFT_CONTRACT_ADDRESS = '0x2A3b1A43842238321a22542a035921A362358189';

const TALENT_NFT_ABI = [
    "event ProfileUnlocked(uint256 indexed tokenId, address indexed employer, uint256 payment)",
    "function unlockProfile(uint256 tokenId) external payable",
    "function getUnlockFee() external view returns (uint256)"
];

const UnlockTalentModal: React.FC<UnlockTalentModalProps> = ({ candidate, canUnlock, onClose, onUnlocked, navigateToBusinessPricing, t }) => {
    const [isPaying, setIsPaying] = useState(false);
    const [unlockFee, setUnlockFee] = useState<string>('...');
    
    React.useEffect(() => {
        const fetchUnlockFee = async () => {
            if (typeof (window as any).ethereum === 'undefined') {
                setUnlockFee('N/A');
                return;
            }
            try {
                const provider = new ethers.BrowserProvider((window as any).ethereum);
                const contract = new ethers.Contract(TALENT_NFT_CONTRACT_ADDRESS, TALENT_NFT_ABI, provider);
                const feeInWei = await contract.getUnlockFee();
                setUnlockFee(ethers.formatEther(feeInWei));
            } catch (e) {
                console.error("Could not fetch unlock fee:", e);
                setUnlockFee('Error');
            }
        };
        fetchUnlockFee();
    }, []);

    const handleOverlayClick = (e: React.MouseEvent<HTMLDivElement>) => {
        if (e.target === e.currentTarget) {
            onClose();
        }
    };
    
    const handleUnlock = async () => {
        if (!canUnlock) {
            navigateToBusinessPricing();
            return;
        }
        if (!candidate.nft_token_id) {
            alert("Error: Candidate does not have a valid NFT token ID.");
            return;
        }

        setIsPaying(true);
        try {
            const provider = new ethers.BrowserProvider((window as any).ethereum);
            const signer = await provider.getSigner();
            const contract = new ethers.Contract(TALENT_NFT_CONTRACT_ADDRESS, TALENT_NFT_ABI, signer);
    
            const feeInWei = await contract.getUnlockFee();
            
            const tx = await contract.unlockProfile(candidate.nft_token_id, { value: feeInWei });
            await tx.wait();

            onUnlocked(candidate);

        } catch (error: any) {
            if (error.code === 'ACTION_REJECTED') {
                alert("Transaction rejected. Please approve the transaction in your wallet to unlock the profile.");
            } else {
                console.error("Unlock transaction failed:", error);
                alert("An error occurred during the transaction. Please check your wallet and try again.");
            }
        } finally {
            setIsPaying(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[70] p-4 animate-fade-in" onClick={handleOverlayClick}>
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-md" onClick={(e) => e.stopPropagation()}>
                <div className="p-6 text-center">
                    <div className="w-16 h-16 mx-auto bg-blue-100 rounded-full flex items-center justify-center mb-4 border-4 border-white shadow-md">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
                    </div>

                    <h3 className="text-xl font-bold text-gray-800">{t('unlock_modal_title')}</h3>
                    <p className="text-gray-500 text-sm">{t('unlock_modal_candidate_id').replace('{id}', String(candidate.index + 1))}</p>

                    <div className="my-6">
                        {canUnlock ? (
                            <p className="text-gray-600">{t('unlock_modal_desc')}</p>
                        ) : (
                             <p className="text-yellow-800 bg-yellow-50 p-3 rounded-md border border-yellow-200">{t('unlock_modal_upgrade_required')}</p>
                        )}
                    </div>

                     {canUnlock && (
                        <div className="p-4 bg-gray-100 rounded-lg">
                            <p className="text-sm text-gray-600 font-medium">{t('unlock_modal_unlock_fee')}</p>
                            <p className="text-3xl font-bold text-gray-900">{unlockFee} ETH</p>
                        </div>
                     )}

                </div>
                 <div className="p-4 border-t bg-gray-50 rounded-b-xl grid grid-cols-2 gap-3">
                    <button onClick={onClose} className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md shadow-sm hover:bg-gray-50">Cancel</button>
                    {canUnlock ? (
                        <button onClick={handleUnlock} disabled={isPaying} className="px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md shadow-sm hover:bg-blue-700 disabled:bg-blue-400">
                             {isPaying ? t('unlock_modal_unlocking') : t('unlock_modal_unlock_with_wallet')}
                        </button>
                    ) : (
                        <button onClick={navigateToBusinessPricing} className="px-4 py-2 text-sm font-medium text-white bg-green-600 border border-transparent rounded-md shadow-sm hover:bg-green-700">
                           {t('unlock_modal_upgrade_button')}
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
};

export default UnlockTalentModal;