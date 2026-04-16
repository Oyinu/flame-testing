// ============================================================
//  CONFIG
// ============================================================
console.log("JS LOADED");

const PROGRAM_ID = "BavvMbqKcVUWMQBwHx6xegULGDvmiRWfX2C9NtyZYqWP";
const NETWORK    = "https://api.devnet.solana.com"; // swap to mainnet-beta when ready
const TOKEN_DECIMALS = 9;
const FLAME_MINT = "5GduPf4TC5JniwLni8t414fmCzdvo8KdFYSswd8ZypJA";

const TOKEN_PROGRAM_ID  = new solanaWeb3.PublicKey("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA");
const SPL_ATA_PROGRAM   = new solanaWeb3.PublicKey("ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJe1bUs");
const SYSTEM_PROGRAM_ID = solanaWeb3.SystemProgram.programId;

// Instruction discriminators — taken directly from your IDL
const DISC_STAKE      = new Uint8Array([206, 176, 202, 18, 200, 209, 179, 108]);
const DISC_UNSTAKE    = new Uint8Array([90, 95, 107, 42, 205, 124, 50, 225]);

// StakeInfo account discriminator (for manual deserialization)
const DISC_STAKE_INFO = new Uint8Array([66, 62, 68, 70, 108, 179, 183, 235]);

// ============================================================
//  TIER CONFIG
// ============================================================
const TIERS = {
  1: { label: "1 month", days: 30, apy: 2 },
  2: { label: "3 Months",  days: 90,  apy: 5  },
  3: { label: "6 Months",  days: 180, apy: 10 },
  4: { label: "12 Months", days: 365, apy: 15 },
};

// ============================================================
//  STATE
// ============================================================
let wallet      = null;
let connection  = null;
let selectedTier = null;
let flameBalance = 0;
let stakeInfo    = null;

// ============================================================
//  EMBERS
// ============================================================
(function () {
  const c = document.getElementById("embers");
  for (let i = 0; i < 14; i++) {
    const e = document.createElement("div");
    e.className = "ember";
    const sz = 2 + Math.random() * 4 + "px";
    e.style.cssText = `left:${8 + Math.random() * 84}%;width:${sz};height:${sz};--dur:${2.5 + Math.random() * 3}s;--delay:${Math.random() * 5}s;--drift:${(Math.random() - 0.5) * 70}px`;
    c.appendChild(e);
  }
})();

// ============================================================
//  HELPERS
// ============================================================
function showToast(msg, type = "info") {
  const t = document.getElementById("toast");
  t.textContent = msg;
  t.className = "toast " + type + " show";
  clearTimeout(t._timer);
  t._timer = setTimeout(() => (t.className = "toast " + type), 3500);
}

function fmt(n) {
  if (n === null || n === undefined) return "—";
  return Number(n).toLocaleString(undefined, { maximumFractionDigits: 2 });
}

function fmtDate(ts) {
  return new Date(Number(ts) * 1000).toLocaleDateString(undefined, {
    year: "numeric", month: "short", day: "numeric",
  });
}

function setLoading(btnId, loading, label) {
  const btn = document.getElementById(btnId);
  if (!btn) return;
  btn.disabled = loading;
  btn.innerHTML = loading ? '<span class="spinner"></span>Processing...' : label;
}

function shortenAddr(addr) {
  return addr.slice(0, 4) + "..." + addr.slice(-4);
}

function calcReward(amount, apyPct, days) {
  return amount * (apyPct / 100) * (days / 365);
}

// Write a u64 (BigInt) into a Uint8Array as little-endian 8 bytes
function writeU64LE(value) {
  const buf = new Uint8Array(8);
  const view = new DataView(buf.buffer);
  view.setBigUint64(0, BigInt(value), true);
  return buf;
}

// ============================================================
//  GET USER TOKEN ACCOUNT (looks up real on-chain ATA)
//  Replaces the old findATA which computed the wrong address
// ============================================================
async function getUserTokenAccount(owner, mint) {
  const accounts = await connection.getTokenAccountsByOwner(owner, { mint });
  if (!accounts.value.length) throw new Error("No $FLAME token account found for this wallet");
  console.log("Real ATA:", accounts.value[0].pubkey.toString());
  return accounts.value[0].pubkey;
}

// ============================================================
//  PDA HELPERS
// ============================================================
function getStakingVaultPDA() {
  return solanaWeb3.PublicKey.findProgramAddressSync(
    [new TextEncoder().encode("staking_vault")],
    new solanaWeb3.PublicKey(PROGRAM_ID)
  )[0];
}

function getStakeInfoPDA(userPubkey) {
  return solanaWeb3.PublicKey.findProgramAddressSync(
    [new TextEncoder().encode("stake"), userPubkey.toBytes()],
    new solanaWeb3.PublicKey(PROGRAM_ID)
  )[0];
}

function getTokenConfigPDA() {
  return solanaWeb3.PublicKey.findProgramAddressSync(
    [new TextEncoder().encode("flame_config")],
    new solanaWeb3.PublicKey(PROGRAM_ID)
  )[0];
}

// ============================================================
//  DESERIALIZE StakeInfo account (manual, no Anchor)
//  Layout (after 8-byte discriminator):
//   owner        [32] pubkey
//   amount       [8]  u64
//   tier         [0]  u8
//   apy_bps      [8]  u64
//   start_time   [8]  i64
//   unlock_time  [8]  i64
//   rewards_claimed [8] u64
//   is_active    [1]  bool
//   bump         [1]  u8
// ============================================================
function deserializeStakeInfo(data) {
  // Verify discriminator
  const disc = new Uint8Array(data.slice(0, 8));
  if (!disc.every((b, i) => b === DISC_STAKE_INFO[i])) {
    throw new Error("Not a StakeInfo account");
  }
  const view = new DataView(data.buffer, data.byteOffset);
  let offset = 8;
  const owner      = new solanaWeb3.PublicKey(data.slice(offset, offset + 32)); offset += 32;
  const amount     = view.getBigUint64(offset, true); offset += 8;
  const tier       = data[offset]; offset += 1;
  const apyBps     = view.getBigUint64(offset, true); offset += 8;
  const startTime  = view.getBigInt64(offset, true);  offset += 8;
  const unlockTime = view.getBigInt64(offset, true);  offset += 8;
  const rewardsClaimed = view.getBigUint64(offset, true); offset += 8;
  const isActive   = data[offset] === 1; offset += 1;
  const bump       = data[offset];

  return { owner, amount, tier, apyBps, startTime, unlockTime, rewardsClaimed, isActive, bump };
}

// ============================================================
//  WALLET
// ============================================================
async function connectWallet() {
  try {
    if (!window.solana || !window.solana.isPhantom) {
      showToast("Phantom wallet not found — please install it", "error");
      return;
    }

    const resp = await window.solana.connect();
    wallet     = resp.publicKey;
    connection = new solanaWeb3.Connection(NETWORK, "confirmed");

    console.log("Connected:", wallet.toString());

    document.getElementById("connectBtn").style.display = "none";
    document.getElementById("walletInfo").classList.add("visible");
    document.getElementById("walletAddr").textContent = shortenAddr(wallet.toString());

    await loadUserData();
    updateStakeButton();

  } catch (err) {
    console.error("connectWallet error:", err);
    showToast(err.message || "Connection failed", "error");
  }
}

function disconnectWallet() {
  if (window.solana) window.solana.disconnect();
  wallet      = null;
  connection  = null;
  stakeInfo   = null;
  flameBalance = 0;
  document.getElementById("connectBtn").style.display = "";
  document.getElementById("walletInfo").classList.remove("visible");
  document.getElementById("walletAddr").textContent = "—";
  document.getElementById("walletBal").textContent  = "— $FLAME";
  resetStats();
  updateStakeButton();
  showToast("Wallet disconnected", "info");
}

// ============================================================
//  LOAD USER DATA
// ============================================================
async function loadUserData() {
  if (!wallet || !connection) return;
  try {
    // --- $FLAME token balance — looks up real on-chain ATA ---
    try {
      const mint = new solanaWeb3.PublicKey(FLAME_MINT);
      const accounts = await connection.getTokenAccountsByOwner(wallet, { mint });
      if (accounts.value.length > 0) {
        const acct = await connection.getTokenAccountBalance(accounts.value[0].pubkey);
        flameBalance = acct.value.uiAmount || 0;
      } else {
        flameBalance = 0;
      }
      document.getElementById("walletBal").textContent   = fmt(flameBalance) + " $FLAME";
      document.getElementById("statBalance").textContent = fmt(flameBalance);
    } catch (err) {
      console.error("Balance fetch error:", err);
      flameBalance = 0;
      document.getElementById("statBalance").textContent = "0";
    }

    // --- Stake info PDA ---
    const stakeInfoPda = getStakeInfoPDA(wallet);
    try {
      const accountInfo = await connection.getAccountInfo(stakeInfoPda);
      if (accountInfo && accountInfo.data && accountInfo.data.length >= 8) {
        const parsed = deserializeStakeInfo(new Uint8Array(accountInfo.data));
        if (parsed.isActive) {
          stakeInfo = parsed;
          showActiveStake(stakeInfo);
          return;
        }
      }
      stakeInfo = null;
      showStakeForm();
    } catch {
      stakeInfo = null;
      showStakeForm();
    }
  } catch (err) {
    console.error("loadUserData error:", err);
    showToast("Error loading account data", "error");
  }
}

// ============================================================
//  SHOW ACTIVE STAKE
// ============================================================
function showActiveStake(info) {
  document.getElementById("activeStakePanel").style.display = "block";
  document.getElementById("stakePanel").style.display = "none";

  const tier     = TIERS[info.tier] || TIERS[1];
  const amountUI = Number(info.amount) / Math.pow(10, TOKEN_DECIMALS);
  const apyPct   = Number(info.apyBps) / 100;
  const reward   = calcReward(amountUI, apyPct, tier.days);
  const startMs  = Number(info.startTime)  * 1000;
  const unlockMs = Number(info.unlockTime) * 1000;
  const now      = Date.now();
  const progress = Math.min(100, Math.max(0, ((now - startMs) / (unlockMs - startMs)) * 100));
  const locked   = now < unlockMs;

  document.getElementById("sdAmount").textContent  = fmt(amountUI) + " $FLAME";
  document.getElementById("sdTier").textContent    = "Tier " + info.tier + " · " + tier.label;
  document.getElementById("sdApy").textContent     = apyPct + "%";
  document.getElementById("sdReward").textContent  = "+" + fmt(reward) + " $FLAME";
  document.getElementById("sdStart").textContent   = fmtDate(info.startTime);
  document.getElementById("sdUnlock").textContent  = fmtDate(info.unlockTime);

  document.getElementById("progressPct").textContent      = Math.round(progress) + "%";
  document.getElementById("progressFill").style.width     = progress + "%";

  document.getElementById("statStaked").textContent  = fmt(amountUI) + " $FLAME";
  document.getElementById("statReward").textContent  = "+" + fmt(reward);
  document.getElementById("statUnlock").textContent  = fmtDate(info.unlockTime);

  const unstakeBtn  = document.getElementById("unstakeBtn");
  const unstakeNote = document.getElementById("unstakeNote");
  unstakeBtn.disabled    = locked;
  unstakeNote.textContent = locked
    ? " Locked until " + fmtDate(info.unlockTime)
    : " Lock period complete — you can unstake now";
}

function showStakeForm() {
  document.getElementById("activeStakePanel").style.display = "none";
  document.getElementById("stakePanel").style.display = "block";
  document.getElementById("statStaked").textContent = "0";
  document.getElementById("statReward").textContent = "—";
  document.getElementById("statUnlock").textContent = "—";
}

function resetStats() {
  ["statBalance", "statStaked", "statReward", "statUnlock"].forEach(
    id => (document.getElementById(id).textContent = "—")
  );
  showStakeForm();
}

// ============================================================
//  TIER SELECTION
// ============================================================
function selectTier(n) {
  selectedTier = n;
  [1, 2, 3, 4].forEach(i =>
    document.getElementById("tier" + i).classList.remove("selected")
  );
  document.getElementById("tier" + n).classList.add("selected");
  updateEstimate();
  updateStakeButton();
}

function updateEstimate() {
  if (selectedTier === null || selectedTier === undefined) return;
  const t      = TIERS[selectedTier];
  const amount = parseFloat(document.getElementById("stakeAmount").value) || 0;
  const reward = calcReward(amount, t.apy, t.days);
  document.getElementById("infoTier").textContent   = "Tier " + selectedTier + " · " + t.label;
  document.getElementById("infoApy").textContent    = t.apy + "%";
  document.getElementById("infoDur").textContent    = t.days + " days";
  document.getElementById("infoReward").textContent = amount > 0 ? "+" + fmt(reward) + " $FLAME" : "—";
  document.getElementById("statReward").textContent = amount > 0 ? "+" + fmt(reward) : "—";
}

function setMax() {
  if (!wallet) { showToast("Connect wallet first", "error"); return; }
  document.getElementById("stakeAmount").value = flameBalance;
  updateEstimate();
}

function updateStakeButton() {
  const btn = document.getElementById("stakeBtn");
  if (!btn) return;
  if (!wallet) {
    btn.textContent = "Connect Wallet to Stake";
    btn.disabled = true;
  } else if (selectedTier === null || selectedTier === undefined) {
    btn.textContent = "Select a Tier First";
    btn.disabled = true;
  } else {
    btn.textContent = "Stake $FLAME Now!";
    btn.disabled = false;
  }
}

// ============================================================
//  STAKE  (raw web3.js — no Anchor)
// ============================================================
async function stake() {
  if (!wallet || !connection) { showToast("Connect wallet first", "error"); return; }
  if (selectedTier === null || selectedTier === undefined) { showToast("Select a staking tier", "error"); return; }

  const amountVal = parseFloat(document.getElementById("stakeAmount").value);
  if (!amountVal || amountVal <= 0) { showToast("Enter a valid amount", "error"); return; }
  if (amountVal > flameBalance)     { showToast("Insufficient $FLAME balance", "error"); return; }

  try {
    setLoading("stakeBtn", true, "");
    showToast("Preparing transaction...", "info");

    const mint          = new solanaWeb3.PublicKey(FLAME_MINT);
    const programId     = new solanaWeb3.PublicKey(PROGRAM_ID);
    const userTokenAcct = await getUserTokenAccount(wallet, mint); // ← real on-chain lookup
    const stakingVault  = getStakingVaultPDA();
    const stakeInfoPda  = getStakeInfoPDA(wallet);
    const tokenConfig   = getTokenConfigPDA();

    // Encode instruction data: discriminator (8) + amount u64 (8) + tier u8 (1)
    const amountLamports = BigInt(Math.floor(amountVal * Math.pow(10, TOKEN_DECIMALS)));
    const amountBytes = writeU64LE(amountLamports);
    const data = new Uint8Array(17);
    data.set(DISC_STAKE, 0);
    data.set(amountBytes, 8);
    data[16] = selectedTier;

    const ix = new solanaWeb3.TransactionInstruction({
      programId,
      keys: [
        { pubkey: wallet,        isSigner: true,  isWritable: true  },
        { pubkey: userTokenAcct, isSigner: false, isWritable: true  },
        { pubkey: stakingVault,  isSigner: false, isWritable: true  },
        { pubkey: stakeInfoPda,  isSigner: false, isWritable: true  },
        { pubkey: tokenConfig,   isSigner: false, isWritable: true  },
        { pubkey: TOKEN_PROGRAM_ID,  isSigner: false, isWritable: false },
        { pubkey: SYSTEM_PROGRAM_ID, isSigner: false, isWritable: false },
      ],
      data,
    });

    const { blockhash, lastValidBlockHeight } =
      await connection.getLatestBlockhash("confirmed");

    const tx = new solanaWeb3.Transaction({
      feePayer: wallet,
      blockhash,
      lastValidBlockHeight,
    }).add(ix);

    showToast("Please approve in Phantom...", "info");

    const signed    = await window.solana.signTransaction(tx);
    const signature = await connection.sendRawTransaction(signed.serialize());
    await connection.confirmTransaction({ signature, blockhash, lastValidBlockHeight }, "confirmed");

    showToast(" Staked! Tx: " + signature.slice(0, 8) + "...", "success");
    document.getElementById("stakeAmount").value = "";
    selectedTier = null;
    [1,2,3,4].forEach(i => document.getElementById("tier"+i).classList.remove("selected"));
    await loadUserData();

  } catch (err) {
    console.error("Stake error:", err);
    const msg = err.message || "";
    if (msg.includes("AlreadyStaked"))          showToast("You already have an active stake", "error");
    else if (msg.includes("InvalidTier"))       showToast("Invalid staking tier", "error");
    else if (msg.includes("InsufficientFunds")) showToast("Insufficient balance", "error");
    else if (msg.includes("No $FLAME"))         showToast("No $FLAME token account found", "error");
    else if (msg.includes("rejected") || msg.includes("User rejected"))
                                                showToast("Transaction rejected", "error");
    else showToast("Stake failed: " + msg.slice(0, 60), "error");
  } finally {
    setLoading("stakeBtn", false, " Stake $FLAME Now");
  }
}

// ============================================================
//  UNSTAKE  (raw web3.js — no Anchor)
// ============================================================
async function unstake() {
  if (!wallet || !connection) { showToast("Connect wallet first", "error"); return; }

  try {
    setLoading("unstakeBtn", true, "");
    showToast("Please approve in Phantom...", "info");

    const mint          = new solanaWeb3.PublicKey(FLAME_MINT);
    const programId     = new solanaWeb3.PublicKey(PROGRAM_ID);
    const userTokenAcct = await getUserTokenAccount(wallet, mint); // ← real on-chain lookup
    const stakingVault  = getStakingVaultPDA();
    const stakeInfoPda  = getStakeInfoPDA(wallet);
    const tokenConfig   = getTokenConfigPDA();

    // Encode instruction data: discriminator only (no args)
    const ix = new solanaWeb3.TransactionInstruction({
      programId,
      keys: [
        { pubkey: wallet,        isSigner: true,  isWritable: true  },
        { pubkey: userTokenAcct, isSigner: false, isWritable: true  },
        { pubkey: stakingVault,  isSigner: false, isWritable: true  },
        { pubkey: stakeInfoPda,  isSigner: false, isWritable: true  },
        { pubkey: tokenConfig,   isSigner: false, isWritable: true  },
        { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
      ],
      data: DISC_UNSTAKE,
    });

    const { blockhash, lastValidBlockHeight } =
      await connection.getLatestBlockhash("confirmed");

    const tx = new solanaWeb3.Transaction({
      feePayer: wallet,
      blockhash,
      lastValidBlockHeight,
    }).add(ix);

    const signed    = await window.solana.signTransaction(tx);
    const signature = await connection.sendRawTransaction(signed.serialize());
    await connection.confirmTransaction({ signature, blockhash, lastValidBlockHeight }, "confirmed");

    showToast(" Unstaked & rewards claimed! Tx: " + signature.slice(0, 8) + "...", "success");
    stakeInfo = null;
    await loadUserData();

  } catch (err) {
    console.error("Unstake error:", err);
    const msg = err.message || "";
    if (msg.includes("StakingLockActive"))  showToast(" Lock period not finished yet", "error");
    else if (msg.includes("NotStaked"))     showToast("No active stake found", "error");
    else if (msg.includes("No $FLAME"))     showToast("No $FLAME token account found", "error");
    else if (msg.includes("rejected") || msg.includes("User rejected"))
                                            showToast("Transaction rejected", "error");
    else showToast("Unstake failed: " + msg.slice(0, 60), "error");
  } finally {
    setLoading("unstakeBtn", false, "Unstake & Claim Rewards");
  }
}

// ============================================================
//  AUTO-RECONNECT ON PAGE LOAD (silent — no popup)
// ============================================================
window.addEventListener("load", async () => {
  if (!window.solana || !window.solana.isPhantom) return;
  try {
    // onlyIfTrusted = reconnect silently if already approved before
    // if never approved, this does nothing (no popup)
    const resp = await window.solana.connect({ onlyIfTrusted: true });
    wallet     = resp.publicKey;
    connection = new solanaWeb3.Connection(NETWORK, "confirmed");
    document.getElementById("connectBtn").style.display = "none";
    document.getElementById("walletInfo").classList.add("visible");
    document.getElementById("walletAddr").textContent = shortenAddr(wallet.toString());
    await loadUserData();
    updateStakeButton();
  } catch {

  }
});

// ============================================================
//  EXPOSE TO GLOBAL SCOPE (required since script is type="module")
// ============================================================
window.connectWallet    = connectWallet;
window.disconnectWallet = disconnectWallet;
window.selectTier       = selectTier;
window.updateEstimate   = updateEstimate;
window.setMax           = setMax;
window.stake            = stake;
window.unstake          = unstake;