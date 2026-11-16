
'use strict';

// THONG KE - FOOTBALLRESULTSV3 (ETHEREUM SEPOLIA)
(() => {
  const ADDRESS = '0xa5f19dcd125ae01334d235f8a0366851f6ecdfe7';

  const RPC_URLS = [
    'https://ethereum-sepolia-rpc.publicnode.com',
    'https://sepolia.gateway.tenderly.co',
    'https://rpc.sepolia.ethpandaops.io'
  ];

  const ABI = [
    'function matchCount() view returns (uint256)',
    'function getMatch(uint256) view returns (string,string,uint8,uint8,uint8,uint8,uint8,uint8,bool)'
  ];

  const $ = id => document.getElementById(id);

  const put = (id, value) => {
    $(id).textContent = String(value);
  };

  // 1. DOC DU LIEU TU SEPOLIA (KHONG CAN METAMASK)
  async function rpc(url, method, params = []) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 12000);

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
        signal: controller.signal
      });

      if (!response.ok) throw new Error(`HTTP ${response.status}`);

      const data = await response.json();

      if (data.error) throw new Error(data.error.message || 'Lỗi RPC');

      if (typeof data.result !== 'string') {
        throw new Error('Phản hồi RPC không hợp lệ');
      }

      return data.result;
    } finally {
      clearTimeout(timer);
    }
  }

  async function readFromRpc(url) {
    const chainId = await rpc(url, 'eth_chainId');

    if (parseInt(chainId, 16) !== 11155111) {
      throw new Error('Sai mạng Blockchain');
    }

    const code = await rpc(url, 'eth_getCode', [ADDRESS, 'latest']);

    if (code === '0x') {
      throw new Error('Không tìm thấy hợp đồng V3');
    }

    const iface = new ethers.Interface(ABI);

    async function call(name, args = []) {
      const data = iface.encodeFunctionData(name, args);

      const result = await rpc(
        url,
        'eth_call',
        [{ to: ADDRESS, data }, 'latest']
      );

      return iface.decodeFunctionResult(name, result);
    }

    const count = Number((await call('matchCount'))[0]);

    if (!Number.isSafeInteger(count) || count < 0 || count > 1000) {
      throw new Error('Số trận đấu không hợp lệ');
    }

    const games = [];

    for (let start = 1; start <= count; start += 5) {
      const ids = Array.from(
        { length: Math.min(5, count - start + 1) },
        (_, index) => start + index
      );

      const data = await Promise.all(
        ids.map(id => call('getMatch', [id]))
      );

      for (const m of data) {
        games.push({
          teamA: m[0],
          teamB: m[1],
          scoreA: Number(m[2]),
          scoreB: Number(m[3]),
          yellowA: Number(m[4]),
          redA: Number(m[5]),
          yellowB: Number(m[6]),
          redB: Number(m[7]),
          finalized: Boolean(m[8])
        });
      }
    }

    return games;
  }

  // 2. GOM THONG KE THEO TEN DOI
  function aggregateTeams(games) {
    const teams = new Map();

    function add(name, scored, conceded, yellow, red) {
      const cleaned = String(name).trim();
      const key = cleaned.toLocaleLowerCase('vi-VN');

      if (!teams.has(key)) {
        teams.set(key, {
          name: cleaned,
          played: 0,
          scored: 0,
          conceded: 0,
          yellow: 0,
          red: 0
        });
      }

      const team = teams.get(key);
      team.played++;
      team.scored += scored;
      team.conceded += conceded;
      team.yellow += yellow;
      team.red += red;
    }

    for (const game of games) {
      add(
        game.teamA,
        game.scoreA,
        game.scoreB,
        game.yellowA,
        game.redA
      );

      add(
        game.teamB,
        game.scoreB,
        game.scoreA,
        game.yellowB,
        game.redB
      );
    }

    return [...teams.values()].sort(
      (a, b) => a.name.localeCompare(b.name, 'vi-VN')
    );
  }

  // 3. CAP NHAT 6 O SO LIEU VA BANG THONG KE
  function render(games) {
    const sum = key =>
      games.reduce((total, game) => total + game[key], 0);

    const finished = games.filter(game => game.finalized).length;

    put('totalGames', games.length);
    put('finishedGames', finished);
    put('openGames', games.length - finished);
    put('totalGoals', sum('scoreA') + sum('scoreB'));
    put('totalYellow', sum('yellowA') + sum('yellowB'));
    put('totalRed', sum('redA') + sum('redB'));

    const teams = aggregateTeams(games);
    put('teamCount', `${teams.length} đội`);

    const body = $('teamRows');
    body.replaceChildren();

    if (!teams.length) {
      const row = document.createElement('tr');
      const cell = document.createElement('td');

      cell.colSpan = 6;
      cell.className = 'empty-table';
      cell.textContent = 'Chưa có dữ liệu thống kê.';

      row.append(cell);
      body.append(row);
      return;
    }

    for (const team of teams) {
      const row = document.createElement('tr');

      [
        team.name,
        team.played,
        team.scored,
        team.conceded,
        team.yellow,
        team.red
      ].forEach((value, index) => {
        const cell = document.createElement('td');
        cell.textContent = String(value);

        if (index === 0) cell.className = 'team-name-cell';
        if (index === 4) cell.classList.add('yellow-count');
        if (index === 5) cell.classList.add('red-count');

        row.append(cell);
      });

      body.append(row);
    }
  }

  // 4. LAM MOI VA TU DONG CHUYEN RPC KHI CO LOI
  async function refresh() {
    const button = $('refreshStats');
    const feedback = $('statsFeedback');
    const source = $('statsSource');

    button.disabled = true;
    button.textContent = 'Đang tải...';

    feedback.textContent = '';
    feedback.classList.remove('error');

    source.textContent = 'Đang tải V3...';
    source.classList.remove('is-live');

    try {
      if (!window.ethers?.Interface) {
        throw new Error('Không tải được ethers.js');
      }

      let lastError;

      for (const url of RPC_URLS) {
        try {
          render(await readFromRpc(url));

          source.textContent = 'Dữ liệu Blockchain · Sepolia (V3)';
          source.classList.add('is-live');
          return;
        } catch (error) {
          lastError = error;
          console.warn('RPC lỗi:', url, error);
        }
      }

      throw lastError || new Error('Không kết nối được Sepolia');

    } catch (error) {
      source.textContent = 'Lỗi tải dữ liệu V3';
      feedback.classList.add('error');
      feedback.textContent = `Không thể đọc dữ liệu V3: ${error.message}`;

    } finally {
      button.disabled = false;
      button.textContent = 'Làm mới dữ liệu';
    }
  }

  // 5. KHOI DONG TRANG
  document.addEventListener('DOMContentLoaded', () => {
    $('refreshStats').addEventListener('click', refresh);
    refresh();
  });
})();
