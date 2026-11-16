'use strict'

// CTUT FOOTBALL BLOCKCHAIN V3
// QUAN LY TRAN DAU VA SU KIEN
;(() => {
  const v3 = window.CTUTV3
  const $ = (id) => document.getElementById(id)

  const ui = {
    connect: $('connectWallet'),
    status: $('walletStatus'),
    address: $('walletAddress'),
    network: $('networkName'),
    permission: $('adminPermission'),
    feedback: $('walletFeedback'),
    rows: $('adminMatchRows'),
    count: $('adminMatchCount'),
    selection: $('matchSelectionFeedback'),
    create: $('createMatchForm'),
    goal: $('recordGoalForm'),
    card: $('recordCardForm'),
    finalize: $('finalizeMatchForm'),
  }

  if (!v3 || Object.values(ui).some((element) => !element)) {
    console.error('Thiếu API V3 hoặc thành phần admin.html.')
    return
  }

  const SEPOLIA = 11155111n

  const RPCS = [
    'https://ethereum-sepolia-rpc.publicnode.com',
    'https://sepolia.gateway.tenderly.co',
    'https://rpc.sepolia.ethpandaops.io',
  ]

  let isAdmin = false
  let busy = false
  let matches = []
  let refreshToken = 0
  let selectedId = null
  let eventsToken = 0
  let abiPromise = null

  // ========================================
  // 01. GIAO DIEN QUAN LY SU KIEN
  // ========================================

  // Su dung muc 05 neu da co trong HTML.
  // Neu chua co thi tu dong tao.
  let section = document.querySelector('.v3-events')

  if (!section) {
    const main = document.querySelector('.admin-main')

    if (!main) {
      console.error('Không tìm thấy .admin-main.')
      return
    }

    section = document.createElement('section')
    section.className = 'panel v3-events'

    section.innerHTML = `
      <div class="panel-heading">
        <div>
          <h2>Quản lý sự kiện trận đấu</h2>
          <p>Xem, chỉnh sửa hoặc hủy sự kiện trước khi chốt kết quả.</p>
        </div>
        <span class="step-number" id="v3EventMatch">05</span>
      </div>

      <p class="inline-feedback" id="v3EventStatus" role="status">
        Hãy chọn một trận đấu.
      </p>

      <div class="v3-event-columns">
        <div class="v3-event-box">
          <h3>Danh sách bàn thắng</h3>
          <div id="v3GoalList">Chưa chọn trận.</div>
        </div>

        <div class="v3-event-box">
          <h3>Danh sách thẻ phạt</h3>
          <div id="v3CardList">Chưa chọn trận.</div>
        </div>
      </div>

      <form id="v3EditGoal" class="admin-form v3-event-edit" hidden>
        <h3>Chỉnh sửa bàn thắng <span id="v3GoalNumber"></span></h3>

        <input type="hidden" name="matchId">
        <input type="hidden" name="eventIndex">

        <label>
          Cầu thủ ghi bàn
          <input type="text" name="playerName" maxlength="100" required>
        </label>

        <div class="form-grid">
          <label>
            Đội bóng
            <select name="team" required>
              <option value="1">Đội A</option>
              <option value="2">Đội B</option>
            </select>
          </label>

          <label>
            Phút ghi bàn
            <input type="number" name="minute"
                   min="1" max="180" step="1" required>
          </label>
        </div>

        <div class="v3-event-buttons">
          <button type="submit" class="primary-btn">Lưu chỉnh sửa</button>
          <button type="button" class="v3-small-btn" id="v3CloseGoal">
            Đóng
          </button>
        </div>
      </form>

      <form id="v3EditCard" class="admin-form v3-event-edit" hidden>
        <h3>Chỉnh sửa thẻ phạt <span id="v3CardNumber"></span></h3>

        <input type="hidden" name="matchId">
        <input type="hidden" name="eventIndex">

        <label>
          Cầu thủ nhận thẻ
          <input type="text" name="playerName" maxlength="100" required>
        </label>

        <div class="form-grid">
          <label>
            Đội bóng
            <select name="team" required>
              <option value="1">Đội A</option>
              <option value="2">Đội B</option>
            </select>
          </label>

          <label>
            Loại thẻ
            <select name="cardType" required>
              <option value="1">Thẻ vàng</option>
              <option value="2">Thẻ đỏ</option>
            </select>
          </label>
        </div>

        <label>
          Phút nhận thẻ
          <input type="number" name="minute"
                 min="1" max="180" step="1" required>
        </label>

        <div class="v3-event-buttons">
          <button type="submit" class="primary-btn">Lưu chỉnh sửa</button>
          <button type="button" class="v3-small-btn" id="v3CloseCard">
            Đóng
          </button>
        </div>
      </form>
    `

    main.appendChild(section)
  }

  // CSS goc cua muc 05.
  // Giu nguyen mau sac, nut bam va bo cuc.

  if (!document.getElementById('v3-event-style')) {
    const style = document.createElement('style')
    style.id = 'v3-event-style'

    style.textContent = `
      .v3-events { margin-top: 20px; }

      .v3-event-columns {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        align-items: start;
        gap: 18px;
        margin-top: 18px;
      }

      .v3-event-box {
        min-width: 0;
        padding: 16px;
        background: #f8fafc;
        border: 1px solid #dfe8f2;
        border-radius: 12px;
      }

      .v3-event-box h3,
      .v3-event-edit h3 {
        font-size: 16px;
        color: #102f50;
        margin: 0 0 14px;
      }

      .v3-record {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        justify-content: space-between;
        gap: 10px;
        margin: 10px 0;
        padding: 12px;
        border: 1px solid #dfe8f2;
        border-radius: 10px;
        background: white;
      }

      .v3-record-info { min-width: 0; }

      .v3-record-info strong {
        display: block;
        font-size: 13px;
        color: #102f50;
        overflow-wrap: anywhere;
      }

      .v3-record-info p {
        margin: 5px 0 0;
        color: #677e97;
        font-size: 12px;
      }

      .v3-record-actions,
      .v3-event-buttons {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
      }

      .v3-small-btn,
      .v3-remove-btn {
        padding: 9px 12px;
        cursor: pointer;
        border-radius: 8px;
        font-weight: 600;
        font-size: 12px;
      }

      .v3-small-btn {
        color: #ba4c0b;
        background: #fff4e9;
        border: 1px solid #ffbf96;
      }

      .v3-remove-btn {
        color: #a12e45;
        background: #fff1f2;
        border: 1px solid #f0b2bd;
      }

      .v3-small-btn:disabled,
      .v3-remove-btn:disabled {
        opacity: .5;
        cursor: not-allowed;
      }

      .v3-record.cancelled { opacity: .65; }

      .v3-record.cancelled em {
        display: block;
        font-size: 12px;
        margin-top: 6px;
      }

      .v3-event-edit {
        margin-top: 18px;
        padding: 18px;
        border: 1px solid #ffc39f;
        border-radius: 12px;
        background: #fffaf6;
      }

      .v3-event-edit[hidden] {
        display: none !important;
      }

      .v3-event-box .v3-empty {
        color: #74869a;
        font-size: 13px;
      }

      @media (max-width: 850px) {
        .v3-event-columns {
          grid-template-columns: 1fr;
        }
      }
    `

    document.head.appendChild(style)
  }

  const ev = {
    section,
    label: $('v3EventMatch'),
    status: $('v3EventStatus'),
    goals: $('v3GoalList'),
    cards: $('v3CardList'),
    goalForm: $('v3EditGoal'),
    cardForm: $('v3EditCard'),
    closeGoal: $('v3CloseGoal'),
    closeCard: $('v3CloseCard'),
  }

  if (Object.values(ev).some((element) => !element)) {
    console.error('Mục 05 thiếu thành phần HTML.')
    return
  }

  // ========================================
  // 02. CAC HAM HO TRO
  // ========================================

  function wallet() {
    const p = window.ethereum
    return p?.providers?.find((x) => x.isMetaMask) || p || null
  }

  function short(value) {
    return `${value.slice(0, 6)}...${value.slice(-4)}`
  }

  function errorText(error) {
    if (error?.code === 4001 || error?.code === 'ACTION_REJECTED') {
      return 'Bạn đã hủy xác nhận trong MetaMask.'
    }

    if (
      error?.code === 'INSUFFICIENT_FUNDS' ||
      /insufficient funds/i.test(error?.message || '')
    ) {
      return 'Ví không đủ SepoliaETH để trả phí giao dịch.'
    }

    return (
      error?.reason ||
      error?.shortMessage ||
      error?.message ||
      'Lỗi không xác định.'
    )
  }

  function notify(message, form) {
    ui.feedback.textContent = message

    if (!form) return

    let node = form.querySelector('.v3-form-feedback')

    if (!node) {
      node = document.createElement('p')
      node.className = 'inline-feedback v3-form-feedback'
      node.setAttribute('role', 'status')
      form.appendChild(node)
    }

    node.textContent = message
  }

  function selectedGame() {
    return matches.find((game) => game.id === selectedId) || null
  }

  function setButtons() {
    ;[ui.create, ui.goal, ui.card, ui.finalize].forEach((form) => {
      form.querySelector('button[type="submit"]').disabled = !isAdmin || busy
    })

    ;[ev.goalForm, ev.cardForm].forEach((form) => {
      form.querySelector('button[type="submit"]').disabled =
        !isAdmin || busy || !selectedId || !!selectedGame()?.finalized
    })

    ev.section.querySelectorAll('[data-event-action]').forEach((button) => {
      button.disabled = !isAdmin || busy || !!selectedGame()?.finalized
    })

    ev.closeGoal.disabled = busy
    ev.closeCard.disabled = busy
    ui.connect.disabled = busy
  }

  function cell(row, value, className = '') {
    const td = document.createElement('td')
    td.textContent = String(value)

    if (className) td.className = className

    row.appendChild(td)
    return td
  }

  function setEmpty(message) {
    ui.rows.replaceChildren()

    const row = document.createElement('tr')
    cell(row, message, 'admin-empty').colSpan = 7

    ui.rows.appendChild(row)
    ui.count.textContent = '0 trận'
  }

  function closeEditors() {
    ev.goalForm.hidden = true
    ev.cardForm.hidden = true
  }

  // ========================================
  // 03. DOC DU LIEU BLOCKCHAIN
  // ========================================

  async function loadAbi() {
    if (!abiPromise) {
      abiPromise = fetch('./footballResultsV3.abi.json')
        .then((response) => {
          if (!response.ok) {
            throw new Error('Không tải được ABI V3.')
          }

          return response.json()
        })
        .catch((error) => {
          abiPromise = null
          throw error
        })
    }

    return abiPromise
  }

  // Doc su kien goc va trang thai huy.
  // Su dung index goc de khong sua/huy nham.

  async function readEvents(matchId) {
    const abi = await loadAbi()
    let lastError

    for (const url of RPCS) {
      try {
        const provider = new ethers.JsonRpcProvider(url)

        if ((await provider.getNetwork()).chainId !== SEPOLIA) {
          continue
        }

        const contract = new ethers.Contract(v3.ADDRESS, abi, provider)

        const [goals, cards] = await Promise.all([
          contract.getGoals(matchId),
          contract.getCardDetails(matchId),
        ])

        const [gFlags, cFlags] = await Promise.all([
          Promise.all(goals.map((_, i) => contract.goalCancelled(matchId, i))),
          Promise.all(cards.map((_, i) => contract.cardCancelled(matchId, i))),
        ])

        return {
          goals: goals.map((item, index) => ({
            index,
            player: item.playerName,
            team: Number(item.team),
            minute: Number(item.minute),
            cancelled: !!gFlags[index],
          })),

          cards: cards.map((item, index) => ({
            index,
            player: item.playerName,
            team: Number(item.team),
            type: Number(item.cardType),
            minute: Number(item.minute),
            cancelled: !!cFlags[index],
          })),
        }
      } catch (error) {
        lastError = error
      }
    }

    throw lastError || new Error('Không đọc được sự kiện trên Sepolia.')
  }

  // ========================================
  // 04. HIEN THI SU KIEN
  // ========================================

  function renderEvents(target, list, kind) {
    target.replaceChildren()

    if (!list.length) {
      const p = document.createElement('p')
      p.className = 'v3-empty'

      p.textContent =
        kind === 'goal' ? 'Chưa có bàn thắng.' : 'Chưa có thẻ phạt.'

      target.appendChild(p)
      return
    }

    for (const item of list) {
      const record = document.createElement('div')

      record.className = 'v3-record' + (item.cancelled ? ' cancelled' : '')

      const info = document.createElement('div')
      info.className = 'v3-record-info'

      const title = document.createElement('strong')
      title.textContent = `#${item.index + 1} · ${item.player}`

      const desc = document.createElement('p')

      const team =
        item.team === 1 ? selectedGame()?.teamA : selectedGame()?.teamB

      desc.textContent =
        kind === 'goal'
          ? `${team || `Đội ${item.team}`} · Phút ${item.minute}`
          : `${team || `Đội ${item.team}`} · ${item.type === 1 ? 'Thẻ vàng' : 'Thẻ đỏ'} · Phút ${item.minute}`

      info.append(title, desc)

      if (item.cancelled) {
        const note = document.createElement('em')
        note.textContent = 'Đã hủy trên Blockchain'
        info.appendChild(note)
      }

      record.appendChild(info)

      if (!item.cancelled) {
        const actions = document.createElement('div')
        actions.className = 'v3-record-actions'

        const edit = document.createElement('button')
        edit.type = 'button'
        edit.className = 'v3-small-btn'
        edit.dataset.eventAction = 'edit'
        edit.textContent = 'Sửa'

        edit.addEventListener('click', () => openEdit(kind, item))

        const cancel = document.createElement('button')
        cancel.type = 'button'
        cancel.className = 'v3-remove-btn'
        cancel.dataset.eventAction = 'cancel'
        cancel.textContent = 'Hủy sự kiện'

        cancel.addEventListener('click', () => cancelEvent(kind, item))

        actions.append(edit, cancel)
        record.appendChild(actions)
      }

      target.appendChild(record)
    }

    setButtons()
  }

  async function loadEvents(matchId) {
    const token = ++eventsToken

    ev.status.textContent = `Đang tải sự kiện trận #${matchId}...`

    try {
      const data = await readEvents(matchId)

      if (token !== eventsToken || selectedId !== matchId) return

      renderEvents(ev.goals, data.goals, 'goal')
      renderEvents(ev.cards, data.cards, 'card')

      ev.status.textContent = selectedGame()?.finalized
        ? `Trận #${matchId} đã chốt. Chỉ có thể xem sự kiện.`
        : `Các sự kiện của trận #${matchId}.`

      setButtons()
    } catch (error) {
      if (token !== eventsToken) return

      ev.status.textContent = 'Không tải được sự kiện: ' + errorText(error)

      console.error(error)
    }
  }

  // ========================================
  // 05. CHON TRAN VA CHINH SUA SU KIEN
  // ========================================

  function selectMatch(game) {
    selectedId = game.id

    ;[ui.goal, ui.card, ui.finalize].forEach((form) => {
      form.elements.namedItem('matchId').value = game.id
    })

    ui.selection.textContent = game.finalized
      ? `Đã chọn trận #${game.id}. Trận đã chốt.`
      : `Đã chọn trận #${game.id}.`

    ev.label.textContent = `Trận #${game.id}`

    ev.goals.replaceChildren()
    ev.cards.replaceChildren()

    closeEditors()
    setButtons()
    loadEvents(game.id)
  }

  function openEdit(kind, item) {
    if (!isAdmin || busy || selectedGame()?.finalized || item.cancelled) return

    closeEditors()

    const form = kind === 'goal' ? ev.goalForm : ev.cardForm

    form.elements.namedItem('matchId').value = selectedId
    form.elements.namedItem('eventIndex').value = item.index
    form.elements.namedItem('playerName').value = item.player
    form.elements.namedItem('team').value = item.team
    form.elements.namedItem('minute').value = item.minute

    if (kind === 'card') {
      form.elements.namedItem('cardType').value = item.type
    }

    $(kind === 'goal' ? 'v3GoalNumber' : 'v3CardNumber').textContent =
      `#${item.index + 1}`

    form.hidden = false
    form.scrollIntoView({ behavior: 'smooth', block: 'nearest' })

    setButtons()
  }

  async function cancelEvent(kind, item) {
    if (!selectedId || busy || !isAdmin || selectedGame()?.finalized) return

    const label = kind === 'goal' ? 'bàn thắng' : 'thẻ phạt'

    if (
      !window.confirm(
        `Hủy ${label} #${item.index + 1} của ${item.player}?\n` +
          'Tỷ số/thẻ sẽ được cập nhật và giao dịch vẫn lưu trên Blockchain.',
      )
    )
      return

    const method = kind === 'goal' ? 'cancelGoal' : 'cancelCard'

    const form = kind === 'goal' ? ev.goalForm : ev.cardForm

    const ok = await sendTransaction(
      method,
      [selectedId, item.index],
      form,
      `hủy ${label}`,
    )

    if (ok) closeEditors()
  }

  // ========================================
  // 06. DANH SACH TRAN DAU
  // ========================================

  function renderGames() {
    ui.rows.replaceChildren()
    ui.count.textContent = `${matches.length} trận`

    if (!matches.length) {
      setEmpty('V3 chưa có trận đấu. Hãy tạo trận đầu tiên.')
      return
    }

    for (const game of matches) {
      const tr = document.createElement('tr')

      cell(tr, `#${game.id}`)
      cell(tr, game.teamA)
      cell(tr, game.teamB)
      cell(tr, `${game.scoreA} - ${game.scoreB}`)

      const cardCell = document.createElement('td')
      cardCell.className = 'admin-cards-cell'

      for (const [name, yellow, red] of [
        ['Đội A', game.yellowA, game.redA],
        ['Đội B', game.yellowB, game.redB],
      ]) {
        const line = document.createElement('div')
        line.className = 'admin-card-line'

        for (const [label, className] of [
          [name, 'admin-card-team'],
          [`🟨 ${yellow}`, 'admin-card-count'],
          [`🟥 ${red}`, 'admin-card-count'],
        ]) {
          const span = document.createElement('span')
          span.className = className
          span.textContent = label

          line.appendChild(span)
        }

        cardCell.appendChild(line)
      }

      tr.appendChild(cardCell)

      const statusCell = document.createElement('td')
      const status = document.createElement('span')

      status.className = game.finalized
        ? 'match-status done'
        : 'match-status pending'

      status.textContent = game.finalized ? 'Đã chốt' : 'Chưa chốt'

      statusCell.appendChild(status)
      tr.appendChild(statusCell)

      const actionCell = document.createElement('td')
      const button = document.createElement('button')

      button.type = 'button'
      button.className = 'admin-select-btn'
      button.textContent = 'Chọn trận'

      button.addEventListener('click', () => selectMatch(game))

      actionCell.appendChild(button)
      tr.appendChild(actionCell)
      ui.rows.appendChild(tr)
    }
  }

  // ========================================
  // 07. TAI DU LIEU VA XAC MINH ADMIN
  // ========================================

  async function refresh() {
    const token = ++refreshToken

    try {
      const { owner, count } = await v3.readSummary()

      if (token !== refreshToken) return

      if (count > 100) {
        throw new Error('Cần phân trang khi có hơn 100 trận.')
      }

      const data = []

      for (let id = 1; id <= count; id++) {
        const item = await v3.readMatch(id)

        if (token !== refreshToken) return

        data.push(item)
      }

      matches = data
      renderGames()

      if (selectedId && !selectedGame()) {
        selectedId = null
        ++eventsToken
        closeEditors()
      }

      const check = $('v3ContractCheck')

      if (check) {
        check.textContent = `V3 trên Sepolia: ${count} trận | Admin: ${short(owner)}`
      }

      const provider = wallet()

      const accounts = provider
        ? await provider.request({ method: 'eth_accounts' })
        : []

      if (token !== refreshToken) return

      const chainId = provider
        ? BigInt(await provider.request({ method: 'eth_chainId' }))
        : null

      if (token !== refreshToken) return

      const connected = accounts.length > 0
      const onSepolia = chainId === SEPOLIA

      isAdmin =
        connected &&
        onSepolia &&
        accounts[0].toLowerCase() === owner.toLowerCase()

      ui.status.textContent = connected ? 'Đã kết nối ví' : 'Chưa kết nối'

      ui.status.classList.toggle('connected', connected)

      ui.address.textContent = connected ? short(accounts[0]) : 'Chưa có'

      ui.address.title = connected ? accounts[0] : ''

      ui.network.textContent = onSepolia
        ? 'Ethereum Sepolia'
        : chainId === null
          ? 'Chưa xác định'
          : `Chain ID: ${chainId}`

      ui.permission.textContent = isAdmin
        ? 'Admin (Chủ hợp đồng V3)'
        : connected
          ? onSepolia
            ? 'Không có quyền Admin V3'
            : 'Chưa đúng mạng'
          : 'Chưa xác minh'

      ui.connect.textContent = connected
        ? 'Đổi ví MetaMask'
        : 'Kết nối MetaMask'

      setButtons()
    } catch (error) {
      if (token !== refreshToken) return

      isAdmin = false
      setButtons()

      setEmpty('Không tải được dữ liệu V3.')

      notify('Lỗi kết nối V3: ' + errorText(error))
      console.error(error)
    }
  }

  // ========================================
  // 08. KET NOI METAMASK
  // ========================================

  ui.connect.addEventListener('click', async () => {
    const provider = wallet()

    if (!provider) {
      return notify('Không tìm thấy MetaMask.')
    }

    ui.connect.disabled = true

    try {
      const accounts = await provider.request({
        method: 'eth_accounts',
      })

      if (accounts.length) {
        await provider.request({
          method: 'wallet_requestPermissions',
          params: [{ eth_accounts: {} }],
        })
      } else {
        await provider.request({
          method: 'eth_requestAccounts',
        })
      }

      const chainId = BigInt(
        await provider.request({
          method: 'eth_chainId',
        }),
      )

      if (chainId !== SEPOLIA) {
        await provider.request({
          method: 'wallet_switchEthereumChain',
          params: [{ chainId: '0xaa36a7' }],
        })
      }

      await refresh()
    } catch (error) {
      notify(errorText(error))
    } finally {
      setButtons()
    }
  })

  // ========================================
  // 09. GUI GIAO DICH SMART CONTRACT
  // ========================================

  async function sendTransaction(method, args, form, label) {
    if (!isAdmin || busy) return false

    busy = true
    setButtons()

    const button = form.querySelector('button[type="submit"]')
    const oldText = button.textContent

    button.textContent = 'Đang xử lý...'

    try {
      const provider = wallet()

      if (
        !provider ||
        BigInt(await provider.request({ method: 'eth_chainId' })) !== SEPOLIA
      ) {
        throw new Error('Hãy chuyển MetaMask sang Ethereum Sepolia.')
      }

      const accounts = await provider.request({
        method: 'eth_accounts',
      })

      if (!accounts.length) {
        throw new Error('Hãy kết nối MetaMask.')
      }

      const browserProvider = new ethers.BrowserProvider(provider)
      const signer = await browserProvider.getSigner()

      const contract = new ethers.Contract(v3.ADDRESS, await loadAbi(), signer)

      const owner = await contract.owner()

      if (owner.toLowerCase() !== (await signer.getAddress()).toLowerCase()) {
        throw new Error('Ví không phải chủ Smart Contract V3.')
      }

      if (method !== 'createMatch') {
        const id = Number(args[0])
        const game = matches.find((g) => g.id === id)

        if (!game) {
          throw new Error(`Không tìm thấy trận #${id}.`)
        }

        const liveMatch = await contract.getMatch(id)

        if (Boolean(liveMatch[8])) {
          throw new Error(`Trận #${id} đã chốt.`)
        }
      }

      // Kiem tra su kien truoc khi sua/huy.
      if (
        ['correctGoal', 'correctCard', 'cancelGoal', 'cancelCard'].includes(
          method,
        )
      ) {
        await contract[method].staticCall(...args)
      }

      notify(`Đang yêu cầu MetaMask xác nhận ${label}...`, form)

      if (method.startsWith('correct') || method.startsWith('cancel')) {
        ev.status.textContent = `Đang yêu cầu MetaMask xác nhận ${label}...`
      }

      const tx = await contract[method](...args)

      notify('Đã gửi giao dịch. Đang chờ Sepolia xác nhận...', form)

      const receipt = await tx.wait()

      if (!receipt || receipt.status !== 1) {
        throw new Error('Giao dịch thất bại.')
      }

      await refresh()

      if (selectedId) {
        await loadEvents(selectedId)
      }

      notify(`Đã ${label} thành công! Tx: ${tx.hash}`, form)

      if (method.startsWith('correct') || method.startsWith('cancel')) {
        ev.status.textContent = `Đã ${label} thành công! Tx: ${tx.hash}`
      }

      if (method === 'createMatch') {
        form.reset()
      }

      return true
    } catch (error) {
      const text = `Không thể ${label}: ${errorText(error)}`

      notify(text, form)

      if (method.startsWith('correct') || method.startsWith('cancel')) {
        ev.status.textContent = text
      }

      console.error(error)
      return false
    } finally {
      busy = false
      button.textContent = oldText
      setButtons()
    }
  }

  // ========================================
  // 10. KIEM TRA DU LIEU NHAP
  // ========================================

  function positiveId(value) {
    const n = Number(value)

    if (!Number.isSafeInteger(n) || n < 1) {
      throw new Error('Mã trận không hợp lệ.')
    }

    return n
  }

  function eventIndex(value) {
    if (value === null || String(value).trim() === '') {
      throw new Error('Hãy chọn sự kiện cần sửa.')
    }

    const n = Number(value)

    if (!Number.isSafeInteger(n) || n < 0) {
      throw new Error('Chỉ số sự kiện không hợp lệ.')
    }

    return n
  }

  function minuteValue(value) {
    const n = Number(value)

    if (!Number.isInteger(n) || n < 1 || n > 180) {
      throw new Error('Phút thi đấu phải từ 1 đến 180.')
    }

    return n
  }

  function textField(data, name) {
    const value = String(data.get(name) || '').trim()

    if (!value) {
      throw new Error(`Vui lòng nhập ${name}.`)
    }

    return value
  }

  function allowedNumber(data, name, allowed) {
    const n = Number(data.get(name))

    if (!allowed.includes(n)) {
      throw new Error(`${name} không hợp lệ.`)
    }

    return n
  }

  function register(form, builder, method, label) {
    form.addEventListener('submit', async (event) => {
      event.preventDefault()

      try {
        const args = builder(new FormData(form))
        const ok = await sendTransaction(method, args, form, label)

        if (ok && (form === ev.goalForm || form === ev.cardForm)) {
          closeEditors()
        }
      } catch (error) {
        notify(errorText(error), form)
      }
    })
  }

  // ========================================
  // 11. DANG KY CAC CHUC NANG QUAN LY
  // ========================================

  // 01. TAO TRAN DAU
  register(
    ui.create,
    (data) => {
      const teamA = textField(data, 'teamA')
      const teamB = textField(data, 'teamB')

      const time = new Date(textField(data, 'startTime')).getTime()

      if (!Number.isFinite(time) || time <= 0) {
        throw new Error('Ngày giờ thi đấu không hợp lệ.')
      }

      return [teamA, teamB, Math.floor(time / 1000), textField(data, 'venue')]
    },
    'createMatch',
    'tạo trận đấu',
  )

  // 02. GHI NHAN BAN THANG
  register(
    ui.goal,
    (data) => [
      positiveId(data.get('matchId')),
      textField(data, 'playerName'),
      allowedNumber(data, 'team', [1, 2]),
      minuteValue(data.get('minute')),
    ],
    'recordGoal',
    'ghi nhận bàn thắng',
  )

  // 03. GHI NHAN THE PHAT
  register(
    ui.card,
    (data) => [
      positiveId(data.get('matchId')),
      textField(data, 'playerName'),
      allowedNumber(data, 'team', [1, 2]),
      allowedNumber(data, 'cardType', [1, 2]),
      minuteValue(data.get('minute')),
    ],
    'recordCard',
    'ghi nhận thẻ phạt',
  )

  // 05A. CHINH SUA BAN THANG
  register(
    ev.goalForm,
    (data) => [
      positiveId(data.get('matchId')),
      eventIndex(data.get('eventIndex')),
      textField(data, 'playerName'),
      allowedNumber(data, 'team', [1, 2]),
      minuteValue(data.get('minute')),
    ],
    'correctGoal',
    'chỉnh sửa bàn thắng',
  )

  // 05B. CHINH SUA THE PHAT
  register(
    ev.cardForm,
    (data) => [
      positiveId(data.get('matchId')),
      eventIndex(data.get('eventIndex')),
      textField(data, 'playerName'),
      allowedNumber(data, 'team', [1, 2]),
      allowedNumber(data, 'cardType', [1, 2]),
      minuteValue(data.get('minute')),
    ],
    'correctCard',
    'chỉnh sửa thẻ phạt',
  )

  ev.closeGoal.addEventListener('click', () => {
    ev.goalForm.hidden = true
  })

  ev.closeCard.addEventListener('click', () => {
    ev.cardForm.hidden = true
  })

  // 04. CHOT KET QUA
  ui.finalize.addEventListener('submit', async (event) => {
    event.preventDefault()

    try {
      const id = positiveId(new FormData(ui.finalize).get('matchId'))

      if (
        !window.confirm(
          `Bạn có chắc muốn chốt trận #${id}?\n` +
            'Sau khi chốt sẽ không thể chỉnh sửa.',
        )
      ) {
        return
      }

      await sendTransaction('finalizeMatch', [id], ui.finalize, 'chốt kết quả')
    } catch (error) {
      notify(errorText(error), ui.finalize)
    }
  })

  // ========================================
  // 12. THEO DOI METAMASK
  // ========================================

  const provider = wallet()

  if (provider?.on) {
    provider.on('accountsChanged', refresh)
    provider.on('chainChanged', refresh)
  }

  // ========================================
  // 13. KHOI DONG
  // ========================================

  setEmpty('Đang tải dữ liệu V3 từ Sepolia...')
  setButtons()
  refresh()
})()
