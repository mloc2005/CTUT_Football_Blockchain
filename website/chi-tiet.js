
'use strict';

// TRANG CHI TIET - DOC DU LIEU VA LICH SU FOOTBALLRESULTSV3
// Su dung bo ket noi CTUTV3 tu blockchain-v3.js.
document.addEventListener('DOMContentLoaded', () => {
  const $ = id => document.getElementById(id);
  const v3 = window.CTUTV3;
  const rpcUrls = [
    'https://ethereum-sepolia-rpc.publicnode.com',
    'https://sepolia.gateway.tenderly.co',
    'https://rpc.sepolia.ethpandaops.io'
  ];
  const deploymentBlock = 12134943;
  const blockStep = 1500;
  const historyNames = [
    'MatchCreated', 'MatchDetailsUpdated', 'GoalRecorded',
    'GoalCorrected', 'GoalCancelled', 'CardRecorded',
    'CardCorrected', 'CardCancelled', 'MatchFinalized'
  ];

  let matchId = null;
  let match = null;
  let historyLoaded = false;
  let historyLoading = false;

  // 1. HAM HO TRO
  function formatTime(value) {
    const seconds = Number(value);
    if (!Number.isSafeInteger(seconds) || seconds <= 0) return 'Chưa cập nhật';
    return new Intl.DateTimeFormat('vi-VN', {
      timeZone: 'Asia/Ho_Chi_Minh', day: '2-digit', month: '2-digit',
      year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false
    }).format(new Date(seconds * 1000));
  }

  function teamName(value) {
    if (value === 1) return match.teamA;
    if (value === 2) return match.teamB;
    return 'Chưa xác định';
  }

  function typeName(value) {
    if (value === 1) return 'Thẻ vàng';
    if (value === 2) return 'Thẻ đỏ';
    return 'Thẻ không xác định';
  }

  function shortAddress(address) {
    return typeof address === 'string' && address.length > 15
      ? `${address.slice(0, 8)}...${address.slice(-6)}`
      : address || 'Chưa xác định';
  }

  // 2. DANH SACH BAN THANG / THE PHAT CON HIEU LUC
  function renderItems(containerId, entries, isGoal) {
    const target = $(containerId);
    target.replaceChildren();
    if (!entries.length) {
      const empty = document.createElement('p');
      empty.className = 'v3-empty';
      empty.textContent = isGoal
        ? 'Chưa ghi nhận bàn thắng.'
        : 'Không có thẻ phạt còn hiệu lực.';
      target.append(empty);
      return;
    }

    for (const entry of [...entries].sort((a, b) => a.minute - b.minute)) {
      const row = document.createElement('div');
      row.className = 'v3-event-row';
      const top = document.createElement('div');
      top.className = 'v3-event-top';
      const name = document.createElement('strong');
      name.className = 'v3-event-person';
      name.textContent = entry.playerName;
      const minute = document.createElement('span');
      minute.className = 'v3-event-minute';
      minute.textContent = `Phút ${entry.minute}`;
      top.append(name, minute);
      const sub = document.createElement('p');
      sub.className = 'v3-event-sub';
      sub.textContent = teamName(entry.team);
      row.append(top, sub);

      if (!isGoal) {
        const badge = document.createElement('span');
        badge.className = `v3-pill ${entry.cardType === 1 ? 'v3-yellow' : 'v3-red'}`;
        badge.textContent = typeName(entry.cardType);
        row.append(badge);
      }
      target.append(row);
    }
  }

  // 3. HIEN THI THONG TIN TRAN DAU
  function renderMatch(game) {
    match = game;
    const number = String(game.id).padStart(2, '0');
    $('detailTitle').textContent = `Chi tiết trận đấu #${number}`;
    $('detailMatchId').textContent = `TRẬN ĐẤU #${number}`;
    $('detailIdValue').textContent = `#${game.id}`;
    $('detailTeamA').textContent = $('cardsTeamA').textContent = game.teamA;
    $('detailTeamB').textContent = $('cardsTeamB').textContent = game.teamB;
    for (const key of ['ScoreA', 'ScoreB', 'YellowA', 'RedA', 'YellowB', 'RedB']) {
      const property = key[0].toLowerCase() + key.slice(1);
      $('detail' + key).textContent = game[property];
    }
    $('detailStartTime').textContent = formatTime(game.startTime);
    $('detailVenue').textContent = game.venue || 'Chưa cập nhật';
    $('detailStateText').textContent = game.finalized ? 'Đã chốt' : 'Chưa chốt';
    const status = $('detailStatus');
    status.className = `status-badge ${game.finalized ? 'status-finalized' : 'status-pending'}`;
    status.textContent = game.finalized ? 'Đã chốt' : 'Chưa chốt';
    $('contractLink').href = `https://sepolia.etherscan.io/address/${v3.ADDRESS}`;
    $('detailSource').textContent = 'Dữ liệu Blockchain · Sepolia (V3)';
    $('detailSource').classList.add('is-live');
    renderItems('detailGoals', game.goals, true);
    renderItems('detailCards', game.cards, false);
    $('detailContent').hidden = false;
    $('detailFeedback').textContent = '';
  }

  // 4. GOI RPC DOC LICH SU BLOCKCHAIN
  async function rpc(url, method, params = []) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 15000);
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
        signal: controller.signal
      });
      if (!response.ok) throw new Error(`RPC HTTP ${response.status}`);
      const json = await response.json();
      if (json.error) throw new Error(json.error.message || 'Lỗi RPC');
      if (json.result === undefined) throw new Error('RPC không có dữ liệu');
      return json.result;
    } finally {
      clearTimeout(timer);
    }
  }

  // 5. MO TA CAC LOAI SU KIEN
  function describe(event) {
    const a = event.args;
    const team = n => teamName(Number(n));
    const card = n => typeName(Number(n)).toLowerCase();
    switch (event.name) {
      case 'MatchCreated':
        return ['Tạo trận đấu', `${a.teamA} gặp ${a.teamB}`];
      case 'MatchDetailsUpdated':
        return ['Cập nhật thông tin', `${formatTime(a.startTime)} · ${a.venue}`];
      case 'GoalRecorded':
        return ['Ghi nhận bàn thắng', `${a.playerName} · ${team(a.team)} · Phút ${a.minute}`];
      case 'GoalCorrected':
        return ['Chỉnh sửa bàn thắng', `${a.oldPlayer} (${team(a.oldTeam)}, phút ${a.oldMinute}) → ${a.newPlayer} (${team(a.newTeam)}, phút ${a.newMinute})`];
      case 'GoalCancelled':
        return ['Hủy bàn thắng', `${a.playerName} · ${team(a.team)} · Phút ${a.minute}`];
      case 'CardRecorded':
        return ['Ghi nhận thẻ phạt', `${a.playerName} · ${team(a.team)} · ${card(a.cardType)} · Phút ${a.minute}`];
      case 'CardCorrected':
        return ['Chỉnh sửa thẻ phạt', `${a.oldPlayer} (${team(a.oldTeam)}, ${card(a.oldCardType)}, phút ${a.oldMinute}) → ${a.newPlayer} (${team(a.newTeam)}, ${card(a.newCardType)}, phút ${a.newMinute})`];
      case 'CardCancelled':
        return ['Hủy thẻ phạt', `${a.playerName} · ${team(a.team)} · ${card(a.cardType)} · Phút ${a.minute}`];
      case 'MatchFinalized':
        return ['Chốt kết quả', 'Kết quả đã được chốt trên Smart Contract.'];
      default:
        return ['Sự kiện Blockchain', ''];
    }
  }

  // 6. HIEN THI LICH SU VA LINK ETHERSCAN
  function showHistory(entries) {
    const target = $('historyList');
    target.replaceChildren();
    if (!entries.length) {
      $('v3HistoryFeedback').textContent = 'Chưa tìm thấy lịch sử của trận đấu này.';
      return;
    }
    $('v3HistoryFeedback').textContent = '';
    for (const event of entries) {
      const [label, description] = describe(event);
      const wrapper = document.createElement('article');
      wrapper.className = 'v3-history-item';
      const title = document.createElement('h3');
      title.className = 'v3-history-name';
      title.textContent = label;
      const content = document.createElement('p');
      content.className = 'v3-history-desc';
      content.textContent = description;
      const meta = document.createElement('div');
      meta.className = 'v3-history-meta';
      for (const line of [
        `Thời gian: ${event.timestamp ? formatTime(event.timestamp) : 'Chưa xác định'}`,
        `Block #${event.blockNumber}`,
        `Ví: ${shortAddress(event.from)}`
      ]) {
        const span = document.createElement('span');
        span.textContent = line;
        meta.append(span);
      }
      const link = document.createElement('a');
      link.className = 'v3-history-link';
      link.href = `https://sepolia.etherscan.io/tx/${event.hash}`;
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      link.textContent = 'Xác minh trên Etherscan';
      wrapper.append(title, content, meta, link);
      target.append(wrapper);
    }
  }

  // 7. DOC NHAT KY GIAO DICH TU SEPOLIA
  async function getHistoryEvents() {
    const response = await fetch('./footballResultsV3.abi.json');
    if (!response.ok) throw new Error('Không tải được ABI V3.');
    const interfaceV3 = new ethers.Interface(await response.json());
    const eventTopics = historyNames.map(name => interfaceV3.getEvent(name).topicHash);
    const matchTopic = ethers.zeroPadValue(ethers.toBeHex(matchId), 32);
    let lastError;

    for (const url of rpcUrls) {
      try {
        const chain = await rpc(url, 'eth_chainId');
        if (Number.parseInt(chain, 16) !== 11155111) {
          throw new Error('RPC không phải mạng Sepolia.');
        }
        const latest = Number.parseInt(await rpc(url, 'eth_blockNumber'), 16);
        const logs = [];
        // Truy van theo nhom block, tranh vuot gioi han public RPC.
        for (let start = deploymentBlock; start <= latest; start += blockStep) {
          const end = Math.min(start + blockStep - 1, latest);
          const batch = await rpc(url, 'eth_getLogs', [{
            address: v3.ADDRESS,
            fromBlock: ethers.toQuantity(start),
            toBlock: ethers.toQuantity(end),
            topics: [eventTopics, matchTopic]
          }]);
          logs.push(...batch);
        }
        logs.sort((a, b) =>
          Number.parseInt(a.blockNumber, 16) - Number.parseInt(b.blockNumber, 16) ||
          Number.parseInt(a.transactionIndex, 16) - Number.parseInt(b.transactionIndex, 16) ||
          Number.parseInt(a.logIndex ?? '0x0', 16) - Number.parseInt(b.logIndex ?? '0x0', 16)
        );
        const blockCache = new Map();
        const txCache = new Map();
        const cached = (cache, key, method, params) => {
          if (!cache.has(key)) {
            cache.set(key, rpc(url, method, params).catch(() => null));
          }
          return cache.get(key);
        };

        return await Promise.all(logs.map(async log => {
          const parsed = interfaceV3.parseLog(log);
          const [block, tx] = await Promise.all([
            cached(blockCache, log.blockNumber, 'eth_getBlockByNumber', [log.blockNumber, false]),
            cached(txCache, log.transactionHash, 'eth_getTransactionByHash', [log.transactionHash])
          ]);
          return {
            name: parsed.name,
            args: parsed.args,
            blockNumber: Number.parseInt(log.blockNumber, 16),
            timestamp: block?.timestamp ? Number.parseInt(block.timestamp, 16) : null,
            from: tx?.from || null,
            hash: log.transactionHash
          };
        }));
      } catch (error) {
        lastError = error;
        console.warn('Lỗi đọc lịch sử V3 tại', url, error);
      }
    }
    throw lastError || new Error('Không đọc được lịch sử trên Sepolia.');
  }

  // 8. CHI TAI LICH SU KHI MO - CO THE THU LAI KHI RPC LOI
  async function loadHistory() {
    if (historyLoading || !match) return;
    historyLoading = true;
    $('retryHistory').hidden = true;
    $('v3HistoryFeedback').classList.remove('error');
    $('v3HistoryFeedback').textContent = 'Đang tải lịch sử Blockchain...';
    try {
      showHistory(await getHistoryEvents());
      historyLoaded = true;
    } catch (error) {
      $('v3HistoryFeedback').textContent = `Không tải được lịch sử: ${error.message}`;
      $('v3HistoryFeedback').classList.add('error');
      $('retryHistory').hidden = false;
    } finally {
      historyLoading = false;
    }
  }

  $('historyDetails').addEventListener('toggle', () => {
    if ($('historyDetails').open && !historyLoaded) loadHistory();
  });
  $('retryHistory').addEventListener('click', loadHistory);

  // 9. KHOI DONG
  async function start() {
    const raw = new URLSearchParams(location.search).get('id');
    if (!raw || !/^\d+$/.test(raw) || !Number.isSafeInteger(Number(raw)) || Number(raw) < 1) {
      $('detailFeedback').textContent =
        'Mã trận đấu không hợp lệ. Hãy quay lại danh sách để chọn trận.';
      $('detailFeedback').classList.add('error');
      $('detailSource').textContent = 'Không hợp lệ';
      return;
    }
    matchId = Number(raw);
    if (!window.ethers?.Interface || !v3?.readMatch) {
      $('detailFeedback').textContent =
        'Không tải được ethers.js hoặc kết nối V3. Hãy kiểm tra Internet và tải lại trang.';
      $('detailFeedback').classList.add('error');
      $('detailSource').textContent = 'Lỗi kết nối';
      return;
    }
    try {
      renderMatch(await v3.readMatch(matchId));
    } catch (error) {
      $('detailFeedback').textContent = `Không tải được trận #${matchId} từ V3: ${error.message}`;
      $('detailFeedback').classList.add('error');
      $('detailSource').textContent = 'Không tải được V3';
    }
  }
  start();
});
