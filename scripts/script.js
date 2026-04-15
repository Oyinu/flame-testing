// ── Ticker ──
const TICKS = [
  " LAUNCHING SOON — IGNITE THE FUTURE",
  " BRIGHT FLAME NEVER DIES",
  " STAKING REWARDS — UP TO 15% APY",
  " 15% BURN AT LAUNCH",
];
const tickerEl = document.getElementById("ticker");
[...TICKS, ...TICKS].forEach((t) => {
  const s = document.createElement("span");
  s.className = "ticker-item";
  s.textContent = t;
  tickerEl.appendChild(s);
});

// ── Embers ──
const emberContainer = document.getElementById("embers");
for (let i = 0; i < 18; i++) {
  const e = document.createElement("div");
  e.className = "ember";
  const size = `${2 + Math.random() * 4}px`;
  e.style.cssText = `left:${8 + Math.random() * 84}%;width:${size};height:${size};animation-duration:${2.5 + Math.random() * 3}s;animation-delay:${Math.random() * 5}s;--drift:${(Math.random() - 0.5) * 70}px`;
  emberContainer.appendChild(e);
}

  const chartElement = document.getElementById("tokenomicsChart");
    if (chartElement) {
        const ctx = chartElement.getContext("2d");
        new Chart(ctx, {
            type: "pie",
            data: {
                labels: [
                    "Burned at Launch",
                    "Liquidity Pool on Raydium",
                    "Staking Rewards",
                    "Mission / Charity Fund",
                    "Team",
                    "Community, Growth & Airdrops"
                ],
                datasets: [
                    {
                        data: [15, 25, 15, 15, 10, 20],
                        backgroundColor: ["red", "yellow", "orange", "grey", "#C0392B", "green"],
                        borderColor: "#1a1a1a",
                        borderWidth: 2
                    }
                ]
            },
            options: {
                responsive: true,
                plugins: {
                    legend: {
                        position: "bottom",
                        labels: {
                            color: "#fff",
                            padding: 16,
                            font: { size: 13 }
                        }
                    }
                }
            }
        });
    }

// ── FAQ ──
const FAQS = [
    {
    q: "What is Bright Flame?",
    a: "Bright Flame is a purpose-driven digital asset project combining decentralized finance with real-world impact, supporting orphans, widows, and underserved communities.",
  },
  {
    q: "What is $FLAME?",
    a: "$FLAME is a community-driven utility token on Solana built around scarcity, staking rewards, and early-mover incentives. It is designed for those who want to get in before the fire spreads.",
  },

  {
    q: "How does the staking system work?",
    a: "Stake $FLAME for 1, 3, 6, or 12 months and earn APY rewards from 2% up to 15%. Longer lockups earn higher yields. Staking opens immediately at launch and rewards compound automatically.",
  },
  {
    q: "What is the purpose of the Early Fund?",
    a: "The Early Fund (10% of total supply) is reserved to reward the earliest supporters, airdrop participants, and community builders who help bootstrap Bright Flame before public listing.",
  },
  {
    q: "Is this safe?",
    a: "Yes. Smart contracts will be audited before launch. Team tokens vest over 6 months with no early unlock.",
  },
];
const faqList = document.getElementById("faq-list");
FAQS.forEach((f, i) => {
  const item = document.createElement("div");
  item.className = "faq-item";
  item.innerHTML = `<button class="faq-q"><span>${f.q}</span><span class="faq-chev">▾</span></button><div class="faq-a"><div class="faq-a-inner">${f.a}</div></div>`;
  item
    .querySelector(".faq-q")
    .addEventListener("click", () => item.classList.toggle("open"));
  faqList.appendChild(item);
});

// ── Wallet register ──
function registerWallet() {
  const v = document.getElementById("wallet-input").value.trim();
  if (!v) return;
  document.getElementById("wallet-success").style.display = "block";
  document.getElementById("wallet-input").style.display = "none";
  document.querySelector(".reg-row .btn-primary").style.display = "none";
}