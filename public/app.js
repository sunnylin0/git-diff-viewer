// Git Diff Log Viewer Frontend Logic (High Performance with Progressive Loading)

const state = {
  repo: 'c:\\GitHub\\ai\\abcjs_663',
  exclude: "':!*min.js' ':!dist/' ':!bin/' ':!*raphael*' ':!*.lock' ':!*prototype*' ':!*.graffle*' ':!*.pdf' ':!*package-lock*' ':!*.svg' ':!*test.html' ':!tests/' ':!docs/'",
  allCommits: [],
  filteredCommits: [],
  renderedCount: 0,
  CHUNK_SIZE: 80,
  selectedCommits: [], // Array of CommitNode
  diffResults: new Map(), // key: from_to -> { files, insertions, deletions, rawStat }
  modalCommit: null,
  activeBaselineCommit: null, // string | null (當前作用中基準 commitId)
  rangeComparedMap: new Map(), // key: commitId -> { order: number }
};

// DOM Elements
const elRepoPath = document.getElementById('repoPath');
const elExcludePattern = document.getElementById('excludePattern');
const elBtnApply = document.getElementById('btnApply');
const elLeftCountBadge = document.getElementById('leftCountBadge');
const elRightCountBadge = document.getElementById('rightCountBadge');
const elLeftSearch = document.getElementById('leftSearch');
const elLeftNodeList = document.getElementById('leftNodeList');
const elRightNodeList = document.getElementById('rightNodeList');
const elBtnClearRight = document.getElementById('btnClearRight');

// Modal Elements
const elModalOverlay = document.getElementById('modalOverlay');
const elBtnModalClose = document.getElementById('btnModalClose');
const elModalCommitId = document.getElementById('modalCommitId');
const elModalSummaryText = document.getElementById('modalSummaryText');
const elModalContent = document.getElementById('modalContent');
const elBtnModalToggleCompare = document.getElementById('btnModalToggleCompare');
const elBtnModalCopyHash = document.getElementById('btnModalCopyHash');
const elToastContainer = document.getElementById('toastContainer');

function showToast(message) {
  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.textContent = message;
  elToastContainer.appendChild(toast);
  setTimeout(() => {
    toast.style.opacity = '0';
    setTimeout(() => toast.remove(), 200);
  }, 2400);
}

// =========================================
// API Calls
// =========================================
async function fetchCommits(force = false) {
  const repo = elRepoPath.value.trim();
  const exclude = elExcludePattern.value.trim();
  state.repo = repo;
  state.exclude = exclude;

  elLeftNodeList.innerHTML = '<div class="empty-state"><p>正在查詢 Git 提交紀錄...</p></div>';

  try {
    const params = new URLSearchParams({ repo, exclude });
    if (force) params.set('force', 'true');
    const res = await fetch(`/api/commits?${params.toString()}`);
    const data = await res.json();

    if (!res.ok || !data.success) {
      throw new Error(data.error || '無法取得 Git 提交紀錄');
    }

    state.allCommits = data.commits || [];
    filterCommits();
    const cacheMsg = data.fromCache
      ? `⚡ 已由快取載入 ${state.allCommits.length} 筆 (${data.cacheFile})`
      : `✨ 掃描完成並已快取 ${state.allCommits.length} 筆 (${data.cacheFile})`;
    showToast(cacheMsg);

    // 如果右側已有選取的節點，依新 exclude 條件重新計算比對
    if (state.selectedCommits.length > 0) {
      await refreshAllDiffs();
    }
  } catch (err) {
    elLeftNodeList.innerHTML = `<div class="empty-state" style="color:var(--accent-red)"><p>載入失敗: ${err.message}</p></div>`;
    showToast(`載入失敗: ${err.message}`);
  }
}

async function fetchDiff(fromCommit, toCommit) {
  const cacheKey = `${fromCommit}_${toCommit}_${state.exclude}`;
  if (state.diffResults.has(cacheKey)) {
    return state.diffResults.get(cacheKey);
  }

  const params = new URLSearchParams({
    repo: state.repo,
    from: fromCommit,
    to: toCommit,
    exclude: state.exclude
  });

  const res = await fetch(`/api/diff?${params.toString()}`);
  const data = await res.json();

  if (!res.ok || !data.success) {
    return { files: 0, insertions: 0, deletions: 0, rawStat: '(比對失敗)' };
  }

  const result = {
    files: data.files,
    insertions: data.insertions,
    deletions: data.deletions,
    rawStat: data.rawStat
  };
  state.diffResults.set(cacheKey, result);
  return result;
}

async function fetchShowStat(commitId) {
  const params = new URLSearchParams({
    repo: state.repo,
    commit: commitId,
    exclude: state.exclude
  });

  const res = await fetch(`/api/show?${params.toString()}`);
  const data = await res.json();
  if (!res.ok || !data.success) {
    throw new Error(data.error || '無法取得 git show');
  }
  return data.rawOutput;
}

// =========================================
// Filtering & Progressive Rendering
// =========================================
function filterCommits() {
  const keyword = elLeftSearch.value.trim().toLowerCase();
  if (!keyword) {
    state.filteredCommits = state.allCommits;
  } else {
    state.filteredCommits = state.allCommits.filter(c =>
      c.commitId.toLowerCase().includes(keyword) ||
      c.message.toLowerCase().includes(keyword) ||
      c.date.includes(keyword)
    );
  }

  elLeftCountBadge.textContent = `${state.filteredCommits.length} / ${state.allCommits.length} 筆`;
  elLeftNodeList.innerHTML = '';
  state.renderedCount = 0;

  if (state.filteredCommits.length === 0) {
    elLeftNodeList.innerHTML = '<div class="empty-state"><p>沒有符合條件的提交節點</p></div>';
    return;
  }

  renderNextChunk();
}

function renderNextChunk() {
  if (state.renderedCount >= state.filteredCommits.length) return;

  const start = state.renderedCount;
  const end = Math.min(start + state.CHUNK_SIZE, state.filteredCommits.length);
  const selectedSet = new Set(state.selectedCommits.map(c => c.commitId));

  const fragment = document.createDocumentFragment();

  for (let i = start; i < end; i++) {
    const commit = state.filteredCommits[i];
    const isSelected = selectedSet.has(commit.commitId);
    const isBaseline = state.activeBaselineCommit === commit.commitId;
    const comparedInfo = state.rangeComparedMap.get(commit.commitId);
    const isCompared = !!comparedInfo;

    const card = document.createElement('div');
    let cardClasses = 'node-card';
    if (isSelected) cardClasses += ' is-selected';
    if (isBaseline) cardClasses += ' is-active-baseline';
    if (isCompared) cardClasses += ' is-range-compared';
    card.className = cardClasses;
    card.id = `left-node-${commit.commitId}`;
    card.dataset.hash = commit.commitId;

    let prefixBadge = '';
    if (isBaseline) {
      prefixBadge = '<span class="baseline-indicator">[基準]</span>';
    } else if (isCompared) {
      prefixBadge = `<span class="range-order-badge">#${comparedInfo.order}</span>`;
    }

    let vsTagHtml = '';
    if (isCompared && state.activeBaselineCommit) {
      const cacheKey = `${state.activeBaselineCommit}_${commit.commitId}_${state.exclude}`;
      const cachedDiff = state.diffResults.get(cacheKey);
      if (cachedDiff) {
        vsTagHtml = `<span class="vs-baseline-tag" id="vs-base-${commit.commitId}">vs 基準: ${cachedDiff.files}(files), <span class="vs-stat-ins">${cachedDiff.insertions}(+)</span>, <span class="vs-stat-del">${cachedDiff.deletions}(-)</span></span>`;
      } else {
        vsTagHtml = `<span class="vs-baseline-tag" id="vs-base-${commit.commitId}"><span class="vs-stat-loading">計算中...</span></span>`;
        fetchDiff(state.activeBaselineCommit, commit.commitId).then(diff => {
          if (state.activeBaselineCommit) {
            updateVsBaselineTag(commit.commitId, diff);
          }
        });
      }
    }

    card.innerHTML = `
      <div class="node-body">
        <div class="node-simplified-line" title="${escapeHtml(commit.formattedLeft)}">
          ${prefixBadge}
          <span class="node-date">${commit.date}</span>,
          <span class="node-hash">${commit.commitId}</span>,
          <span class="node-msg">${escapeHtml(commit.message || '(無訊息)')}</span>,
          <span class="node-stat-pill">
            <span class="stat-files">${commit.files}(files)</span>,
            <span class="stat-ins">${commit.insertions}(+)</span>,
            <span class="stat-del">${commit.deletions}(-)</span>
          </span>
          ${vsTagHtml}
        </div>
      </div>
      <div class="node-actions">
        ${renderCardActions(commit.commitId, isSelected, isBaseline)}
      </div>
    `;

    fragment.appendChild(card);
  }

  elLeftNodeList.appendChild(fragment);
  state.renderedCount = end;
}

function renderCardActions(commitId, isSelected, isBaseline) {
  return `
    ${isSelected
      ? `<button class="btn btn-sm btn-action-remove" data-action="remove" data-hash="${commitId}">移除</button>`
      : `<button class="btn btn-sm btn-action-add" data-action="add" data-hash="${commitId}">加入</button>`
    }
    <button class="btn btn-sm btn-action-base ${isBaseline ? 'is-active' : ''}" data-action="set-base" data-hash="${commitId}">
      ${isBaseline ? '取消基準' : '基準'}
    </button>
  `;
}

function updateVsBaselineTag(targetCommitId, diff) {
  const tag = document.getElementById(`vs-base-${targetCommitId}`);
  if (!tag) return;
  tag.innerHTML = `vs 基準: ${diff.files}(files), <span class="vs-stat-ins">${diff.insertions}(+)</span>, <span class="vs-stat-del">${diff.deletions}(-)</span>`;
}

function refreshLeftPanelDOM() {
  const currentRendered = state.renderedCount;
  const scrollTop = elLeftNodeList.scrollTop;
  elLeftNodeList.innerHTML = '';
  state.renderedCount = 0;

  const targetCount = Math.max(currentRendered, state.CHUNK_SIZE);
  const totalToRender = Math.min(targetCount, state.filteredCommits.length);

  const prevChunk = state.CHUNK_SIZE;
  state.CHUNK_SIZE = totalToRender;
  renderNextChunk();
  state.CHUNK_SIZE = prevChunk;

  elLeftNodeList.scrollTop = scrollTop;
}

function clearBaseline() {
  state.activeBaselineCommit = null;
  state.rangeComparedMap.clear();
  refreshLeftPanelDOM();
  showToast('已取消基準');
}

async function setActiveBaseline(baseCommitId) {
  const idx = state.allCommits.findIndex(c => c.commitId === baseCommitId);
  if (idx === -1) return;

  state.activeBaselineCommit = baseCommitId;
  state.rangeComparedMap.clear();

  // 取出後續最多 100 筆
  const targets = state.allCommits.slice(idx + 1, idx + 201);
  targets.forEach((c, i) => {
    state.rangeComparedMap.set(c.commitId, { order: i + 1 });
  });

  refreshLeftPanelDOM();
  showToast(`已設定基準: ${baseCommitId}，比對後續 ${targets.length} 筆節點`);

  // 非同步批次計算 diff（併發 6 個連線）
  queueBatchDiffs(baseCommitId, targets);
}

async function queueBatchDiffs(baseCommitId, targets) {
  const concurrency = 6;
  let cursor = 0;
  async function worker() {
    while (cursor < targets.length) {
      if (state.activeBaselineCommit !== baseCommitId) return;
      const targetCommit = targets[cursor++];
      if (!targetCommit) break;
      const diff = await fetchDiff(baseCommitId, targetCommit.commitId);
      if (state.activeBaselineCommit === baseCommitId) {
        updateVsBaselineTag(targetCommit.commitId, diff);
      }
    }
  }
  const workers = Array.from({ length: Math.min(concurrency, targets.length) }, () => worker());
  await Promise.all(workers);
}

// Infinite scroll on left panel
elLeftNodeList.addEventListener('scroll', () => {
  const { scrollTop, scrollHeight, clientHeight } = elLeftNodeList;
  if (scrollTop + clientHeight >= scrollHeight - 300) {
    renderNextChunk();
  }
});

// Event delegation for left node list clicks
elLeftNodeList.addEventListener('click', (e) => {
  const target = e.target;
  const btn = target.closest('button[data-action]');
  const card = target.closest('.node-card');
  if (!card) return;

  const commitId = card.dataset.hash;
  const commit = state.allCommits.find(c => c.commitId === commitId);
  if (!commit) return;

  if (btn) {
    e.stopPropagation();
    const action = btn.dataset.action;
    if (action === 'add') {
      addToCompare(commit);
    } else if (action === 'remove') {
      removeFromCompare(commitId);
    } else if (action === 'set-base') {
      if (state.activeBaselineCommit === commitId) {
        clearBaseline();
      } else {
        setActiveBaseline(commitId);
      }
    }
    return;
  }

  // Clicked node body -> open modal inspector
  const body = target.closest('.node-body');
  if (body) {
    openModal(commit);
  }
});

// =========================================
// Right Panel: Comparison Chain
// =========================================
async function renderRightPanel() {
  elRightCountBadge.textContent = `${state.selectedCommits.length} 筆`;

  if (state.selectedCommits.length === 0) {
    elRightNodeList.innerHTML = `
      <div class="empty-state">
        <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
          <polyline points="14 2 14 8 20 8"></polyline>
          <line x1="12" y1="18" x2="12" y2="12"></line>
          <line x1="9" y1="15" x2="15" y2="15"></line>
        </svg>
        <p>尚未選取節點</p>
        <p class="subtext">請由左側點擊「加入」按鈕，選取節點進行鏈式 Diff 比對</p>
      </div>
    `;
    return;
  }

  const fragment = document.createDocumentFragment();

  for (let i = 0; i < state.selectedCommits.length; i++) {
    const commit = state.selectedCommits[i];
    const wrapper = document.createElement('div');
    wrapper.className = 'compare-card-wrapper';

    // Connector between nodes
    if (i > 0) {
      const conn = document.createElement('div');
      conn.className = 'compare-connector';
      wrapper.appendChild(conn);
    }

    const card = document.createElement('div');
    card.className = `compare-card ${i === 0 ? 'is-baseline' : ''}`;
    card.title = '點擊跳轉定位至左側節點';
    card.dataset.hash = commit.commitId;

    if (i === 0) {
      // 基準節點
      card.innerHTML = `
        <div class="node-body">
          <div class="node-simplified-line">
            <span class="baseline-tag">[基準]</span>
            <span class="node-date">${commit.date}</span>,
            <span class="node-hash">${commit.commitId}</span>,
            <span class="node-stat-pill">
              <span class="stat-files">-(files)</span>,
              <span class="stat-ins">-(+)</span>,
              <span class="stat-del">-(-)</span>
            </span>
          </div>
        </div>
        <div class="node-actions">
          <button class="btn btn-sm btn-action-remove" data-action="remove" data-hash="${commit.commitId}">移除</button>
        </div>
      `;
    } else {
      // 後續節點：先即時呈現，再異步填入 diff 統計
      const prevCommit = state.selectedCommits[i - 1];
      const cacheKey = `${prevCommit.commitId}_${commit.commitId}_${state.exclude}`;
      const cachedDiff = state.diffResults.get(cacheKey);

      card.innerHTML = `
        <div class="node-body">
          <div class="node-simplified-line">
            <span class="diff-step-tag">&darr; diff</span>
            <span class="node-date">${commit.date}</span>,
            <span class="node-hash">${commit.commitId}</span>,
            <span class="node-stat-pill" id="diff-stat-${commit.commitId}">
              ${cachedDiff
          ? `<span class="stat-files">${cachedDiff.files}(files)</span>,
                     <span class="stat-ins">${cachedDiff.insertions}(+)</span>,
                     <span class="stat-del">${cachedDiff.deletions}(-)</span>`
          : `<span class="stat-files">計算中...</span>`
        }
            </span>
          </div>
        </div>
        <div class="node-actions">
          <button class="btn btn-sm btn-action-remove" data-action="remove" data-hash="${commit.commitId}">移除</button>
        </div>
      `;

      if (!cachedDiff) {
        fetchDiff(prevCommit.commitId, commit.commitId).then(diff => {
          const statEl = document.getElementById(`diff-stat-${commit.commitId}`);
          if (statEl) {
            statEl.innerHTML = `
              <span class="stat-files">${diff.files}(files)</span>,
              <span class="stat-ins">${diff.insertions}(+)</span>,
              <span class="stat-del">${diff.deletions}(-)</span>
            `;
          }
        });
      }
    }

    wrapper.appendChild(card);
    fragment.appendChild(wrapper);
  }

  elRightNodeList.innerHTML = '';
  elRightNodeList.appendChild(fragment);
}

// Event delegation for right comparison list clicks
elRightNodeList.addEventListener('click', (e) => {
  const btn = e.target.closest('button[data-action="remove"]');
  const card = e.target.closest('.compare-card');
  if (!card) return;

  const commitId = card.dataset.hash;
  if (btn) {
    e.stopPropagation();
    removeFromCompare(commitId);
    return;
  }

  // Click card navigates and scrolls to left panel node
  jumpToLeftNode(commitId);
});

// =========================================
// User Actions
// =========================================
function addToCompare(commit) {
  if (state.selectedCommits.some(c => c.commitId === commit.commitId)) {
    return;
  }
  state.selectedCommits.push(commit);

  // Directly update left card without re-rendering all nodes
  const leftCard = document.getElementById(`left-node-${commit.commitId}`);
  if (leftCard) {
    leftCard.classList.add('is-selected');
    const actions = leftCard.querySelector('.node-actions');
    if (actions) {
      const isBaseline = state.activeBaselineCommit === commit.commitId;
      actions.innerHTML = renderCardActions(commit.commitId, true, isBaseline);
    }
  }

  renderRightPanel();
  showToast(`已加入節點 ${commit.commitId}`);
}

function removeFromCompare(commitId) {
  state.selectedCommits = state.selectedCommits.filter(c => c.commitId !== commitId);

  // Directly update left card
  const leftCard = document.getElementById(`left-node-${commitId}`);
  if (leftCard) {
    leftCard.classList.remove('is-selected');
    const actions = leftCard.querySelector('.node-actions');
    if (actions) {
      const isBaseline = state.activeBaselineCommit === commitId;
      actions.innerHTML = renderCardActions(commitId, false, isBaseline);
    }
  }

  renderRightPanel();
  if (state.modalCommit && state.modalCommit.commitId === commitId) {
    updateModalButtons();
  }
}

async function refreshAllDiffs() {
  state.diffResults.clear();
  await renderRightPanel();
}

function jumpToLeftNode(commitId) {
  let target = document.getElementById(`left-node-${commitId}`);
  if (!target) {
    // If not currently rendered, find its index and render up to it
    const index = state.filteredCommits.findIndex(c => c.commitId === commitId);
    if (index >= 0) {
      while (state.renderedCount <= index) {
        renderNextChunk();
      }
      target = document.getElementById(`left-node-${commitId}`);
    } else {
      // Filtered out, reset search
      elLeftSearch.value = '';
      filterCommits();
      const newIndex = state.filteredCommits.findIndex(c => c.commitId === commitId);
      if (newIndex >= 0) {
        while (state.renderedCount <= newIndex) {
          renderNextChunk();
        }
        target = document.getElementById(`left-node-${commitId}`);
      }
    }
  }

  if (target) {
    target.scrollIntoView({ behavior: 'smooth', block: 'center' });
    target.classList.remove('flash-highlight');
    void target.offsetWidth; // trigger reflow
    target.classList.add('flash-highlight');
  }
}

// =========================================
// Modal (Node Inspector)
// =========================================
async function openModal(commit) {
  state.modalCommit = commit;
  elModalCommitId.textContent = `${commit.commitId} (${commit.date})`;
  elModalSummaryText.textContent = commit.message || '(無訊息)';
  elModalContent.textContent = '載入中...';
  updateModalButtons();

  elModalOverlay.classList.add('open');

  try {
    const rawOutput = await fetchShowStat(commit.commitId);
    elModalContent.textContent = rawOutput || '(無變更或內容)';
  } catch (err) {
    elModalContent.textContent = `載入失敗: ${err.message}`;
  }
}

function closeModal() {
  elModalOverlay.classList.remove('open');
  state.modalCommit = null;
}

function updateModalButtons() {
  if (!state.modalCommit) return;
  const isSelected = state.selectedCommits.some(c => c.commitId === state.modalCommit.commitId);
  if (isSelected) {
    elBtnModalToggleCompare.textContent = '從比對移除';
    elBtnModalToggleCompare.className = 'btn btn-sm btn-action-remove';
  } else {
    elBtnModalToggleCompare.textContent = '加入比對';
    elBtnModalToggleCompare.className = 'btn btn-sm btn-primary';
  }
}

// =========================================
// Helpers & Event Listeners
// =========================================
function escapeHtml(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// Event Listeners
elBtnApply.addEventListener('click', () => {
  fetchCommits(true);
});

elRepoPath.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') fetchCommits(true);
});

elExcludePattern.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') fetchCommits(true);
});

elLeftSearch.addEventListener('input', () => {
  filterCommits();
});

elBtnClearRight.addEventListener('click', () => {
  const prevSelected = [...state.selectedCommits];
  state.selectedCommits = [];
  prevSelected.forEach(c => {
    const card = document.getElementById(`left-node-${c.commitId}`);
    if (card) {
      card.classList.remove('is-selected');
      const actions = card.querySelector('.node-actions');
      if (actions) {
        actions.innerHTML = `<button class="btn btn-sm btn-action-add" data-action="add" data-hash="${c.commitId}">加入</button>`;
      }
    }
  });
  renderRightPanel();
  showToast('已清空比對清單');
});

elBtnModalClose.addEventListener('click', closeModal);
elModalOverlay.addEventListener('click', (e) => {
  if (e.target === elModalOverlay) closeModal();
});

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && elModalOverlay.classList.contains('open')) {
    closeModal();
  }
});

elBtnModalToggleCompare.addEventListener('click', () => {
  if (!state.modalCommit) return;
  const isSelected = state.selectedCommits.some(c => c.commitId === state.modalCommit.commitId);
  if (isSelected) {
    removeFromCompare(state.modalCommit.commitId);
  } else {
    addToCompare(state.modalCommit);
  }
  updateModalButtons();
});

elBtnModalCopyHash.addEventListener('click', async () => {
  if (!state.modalCommit) return;
  try {
    await navigator.clipboard.writeText(state.modalCommit.commitId);
    showToast(`已複製 Commit ID: ${state.modalCommit.commitId}`);
  } catch (err) {
    showToast('複製失敗');
  }
});

// Initial load
fetchCommits();
