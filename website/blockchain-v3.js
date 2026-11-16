
'use strict';

// BO KET NOI SMART CONTRACT V3 - ETHEREUM SEPOLIA
(() => {
  const ADDRESS = '0xa5f19dcd125ae01334d235f8a0366851f6ecdfe7';

  const ABI_FILE = './footballResultsV3.abi.json';

  const RPC_URLS = [
    'https://ethereum-sepolia-rpc.publicnode.com',
    'https://sepolia.gateway.tenderly.co',
    'https://rpc.sepolia.ethpandaops.io'
  ];

  let abiPromise;

  async function loadAbi() {
    if (!abiPromise) {
      abiPromise = fetch(ABI_FILE)
        .then(response => {
          if (!response.ok) {
            throw new Error('Không tải được ABI V3.');
          }
          return response.json();
        })
        .then(abi => {
          if (!Array.isArray(abi)) {
            throw new Error('ABI V3 không hợp lệ.');
          }
          return abi;
        })
        .catch(error => {
          abiPromise = null;
          throw error;
        });
    }
    return abiPromise;
  }

  // Ket noi RPC Sepolia de doc du lieu
  async function getReader() {
    if (typeof ethers === 'undefined') {
      throw new Error('Chưa tải thư viện ethers.js.');
    }

    const abi = await loadAbi();
    let lastError;

    for (const url of RPC_URLS) {
      try {
        const provider = new ethers.JsonRpcProvider(url);
        const network = await provider.getNetwork();

        if (network.chainId !== 11155111n) {
          throw new Error('RPC không thuộc Sepolia.');
        }

        const code = await provider.getCode(ADDRESS);

        if (code === '0x') {
          throw new Error('Không tìm thấy Smart Contract V3.');
        }

        return new ethers.Contract(ADDRESS, abi, provider);
      } catch (error) {
        lastError = error;
      }
    }

    throw lastError || new Error('Không kết nối được Sepolia.');
  }

  // Kiem tra owner va tong so tran
  async function readSummary() {
    const contract = await getReader();

    const [owner, rawCount] = await Promise.all([
      contract.owner(),
      contract.matchCount()
    ]);

    const count = Number(rawCount);

    if (!Number.isSafeInteger(count) || count < 0 || count > 1000) {
      throw new Error('Số trận đấu không hợp lệ.');
    }

    return { owner, count };
  }

  // Doc toan bo thong tin mot tran
  async function readMatch(matchId) {
    const id = Number(matchId);

    if (!Number.isSafeInteger(id) || id < 1) {
      throw new Error('Mã trận đấu không hợp lệ.');
    }

    const contract = await getReader();

    const [match, extra, goals, cards] = await Promise.all([
      contract.getMatch(id),
      contract.getMatchDetails(id),
      contract.getActiveGoals(id),
      contract.getActiveCardDetails(id)
    ]);

    return {
      id,
      teamA: match[0],
      teamB: match[1],
      scoreA: Number(match[2]),
      scoreB: Number(match[3]),
      yellowA: Number(match[4]),
      redA: Number(match[5]),
      yellowB: Number(match[6]),
      redB: Number(match[7]),
      finalized: Boolean(match[8]),

      startTime: Number(extra[0]),
      venue: extra[1],

      goals: goals.map(goal => ({
        playerName: goal.playerName,
        team: Number(goal.team),
        minute: Number(goal.minute)
      })),

      cards: cards.map(card => ({
        playerName: card.playerName,
        team: Number(card.team),
        cardType: Number(card.cardType),
        minute: Number(card.minute)
      }))
    };
  }

  window.CTUTV3 = {
    ADDRESS,
    readSummary,
    readMatch
  };

  // Hien thi ket qua kiem tra tren trang Admin
  document.addEventListener('DOMContentLoaded', async () => {
    const status = document.getElementById('v3ContractCheck');

    if (!status) return;

    try {
      const { owner, count } = await readSummary();

      status.textContent =
        `V3 trên Sepolia: ${count} trận | Admin: ` +
        `${owner.slice(0, 6)}...${owner.slice(-4)}`;
    } catch (error) {
      status.textContent =
        `Kiểm tra V3 thất bại: ${error.message}`;
    }
  });
})();
