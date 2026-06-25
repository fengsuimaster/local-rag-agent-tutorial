let sessionId = null;
let isStreaming = false;
let currentStreamBubble = null;
let messages = [];
let ragResultsCache = {};  // { assistMsgId: results[] }

// ─── 对话目录 ───
function toggleToc() {
  const panel = document.getElementById('toc-panel');
  const isOpen = panel.classList.contains('open');
  if (isOpen) {
    panel.classList.remove('open');
  } else {
    refreshTocList();
    panel.classList.add('open');
  }
}

function refreshTocList() {
  const list = document.getElementById('toc-list');
  const userMsgs = messages.filter(m => m.role === 'user');
  if (userMsgs.length === 0) {
    list.innerHTML = '<div class="toc-empty">暂无对话记录</div>';
    return;
  }
  list.innerHTML = userMsgs.map((m, i) => {
    const text = (m.content || '').replace(/\n/g, ' ').slice(0, 60);
    const escaped = escapeHtml(text);
    return `<button class="toc-item" onclick="scrollToMessage('${m.id}');event.stopPropagation();">
      <span class="toc-num">${i + 1}.</span>${escaped}${(m.content||'').length > 60 ? '...' : ''}
    </button>`;
  }).join('');
}

function scrollToMessage(msgId) {
  // 收起目录
  document.getElementById('toc-panel').classList.remove('open');
  // 高亮跳转
  const el = document.getElementById(msgId);
  if (!el) return;
  el.scrollIntoView({ behavior: 'smooth', block: 'center' });
  // 高亮闪烁
  el.classList.add('msg-flash');
  setTimeout(() => el.classList.remove('msg-flash'), 1600);
}

function escapeHtml(s) { const d=document.createElement('div'); d.textContent=s; return d.innerHTML; }

document.addEventListener('DOMContentLoaded', () => {
  loadFromStorage();
  loadSettings();
  document.getElementById('message-input').focus();
  document.getElementById('message-input').addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  });
  document.getElementById('settings-modal').addEventListener('click', (e) => {
    if (e.target === e.currentTarget) closeSettings();
  });
});

function loadFromStorage() {
  try {
    const saved = localStorage.getItem('chat_messages');
    if (saved) {
      messages = JSON.parse(saved);
      messages.forEach(msg => appendMessage(msg.role, msg.content, false, msg.id));
      scrollToBottom();
    }
    sessionId = localStorage.getItem('chat_sessionId');
    // 恢复 RAG 检索结果卡片
    const savedRag = localStorage.getItem('chat_ragResults');
    if (savedRag) {
      ragResultsCache = JSON.parse(savedRag);
      Object.entries(ragResultsCache).forEach(([assistId, results]) => {
        if (results && results.length > 0) {
          restoreRagCard(assistId, results);
        }
      });
    }
  } catch (e) {}
}

function saveToStorage() {
  try {
    localStorage.setItem('chat_messages', JSON.stringify(messages.map(m => ({ role: m.role, content: m.content, id: m.id }))));
    localStorage.setItem('chat_ragResults', JSON.stringify(ragResultsCache));
    if (sessionId) localStorage.setItem('chat_sessionId', sessionId);
  } catch (e) {}
}

function loadSettings() {
  try {
    const s = JSON.parse(localStorage.getItem('chat_settings') || '{}');
    if (s.model) document.getElementById('setting-model').value = s.model;
    if (s.api) document.getElementById('setting-api').value = s.api;
  } catch (e) {}
}

function appendMessage(role, content, animate, id) {
  const welcome = document.getElementById('welcome');
  if (welcome) welcome.style.display = 'none';
  const msgId = id || `msg_${Date.now()}_${Math.random().toString(36).slice(2,6)}`;
  const div = document.createElement('div');
  div.className = `message ${role}`;
  div.id = msgId;
  const bubble = document.createElement('div');
  bubble.className = 'bubble';
  if (role === 'assistant') {
    bubble.innerHTML = renderMarkdown(content);
    bubble.querySelectorAll('pre').forEach(addCopyButton);
  } else {
    bubble.textContent = content;
  }
  div.appendChild(bubble);
  // 插入到 chat-content 容器内
  document.getElementById('chat-content').appendChild(div);
  scrollToBottom();
  return msgId;
}

function updateBubbleText(id, content) {
  const div = document.getElementById(id);
  if (!div) return;
  const bubble = div.querySelector('.bubble');
  if (!bubble) return;
  bubble.innerHTML = renderMarkdown(content);
  bubble.querySelectorAll('pre').forEach(addCopyButton);
  scrollToBottom();
}

function appendToolStatus(name, input) {
  const welcome = document.getElementById('welcome');
  if (welcome) welcome.style.display = 'none';
  const map = { Read:'读取文件', Write:'写入文件', Edit:'编辑文件', Bash:'执行命令', Glob:'搜索文件', Grep:'内容搜索', WebFetch:'获取网页', WebSearch:'网络搜索' };
  const label = map[name] || name;
  const detail = input?.file_path || input?.command || input?.pattern || '';
  const divId = `tool_${Date.now()}_${Math.random().toString(36).slice(2,6)}`;
  const div = document.createElement('div');
  div.className = 'tool-status';
  div.id = divId;
  div.innerHTML = `<span class="dot"></span> ${label}${detail ? ' : ' + detail : '...'}`;
  // 插入到 chat-content 容器内
  document.getElementById('chat-content').appendChild(div);
  scrollToBottom();
  return divId;
}

function finishToolStatus(id) {
  const div = document.getElementById(id);
  if (!div) return;
  div.className = 'tool-result';
  div.innerHTML = '已完成';
  setTimeout(() => { if (div.parentNode) div.remove(); }, 3000);
}

// 构建 RAG 卡片 DOM（纯函数，不插入）
function buildRagCard(results) {
  const container = document.createElement('div');
  container.className = 'rag-results';
  const header = document.createElement('div');
  header.className = 'rag-header collapsed';
  header.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg> 检索到 <strong>${results.length}</strong> 条参考资料 <span class="rag-hint">点击展开</span>`;
  header.onclick = () => {
    const body = container.querySelector('.rag-body');
    if (body.style.display === 'none') {
      body.style.display = 'block';
      header.classList.remove('collapsed');
    } else {
      body.style.display = 'none';
      header.classList.add('collapsed');
    }
  };
  container.appendChild(header);
  const body = document.createElement('div');
  body.className = 'rag-body';
  body.style.display = 'none';
  results.forEach((r, i) => {
    const item = document.createElement('div');
    item.className = 'rag-item';
    const scorePercent = Math.round(r.score * 100);
    let scoreClass = 'rag-score-low';
    if (scorePercent >= 80) scoreClass = 'rag-score-high';
    else if (scorePercent >= 65) scoreClass = 'rag-score-mid';

    const cleanSection = (r.section || '')
      .replace(/\r/g, '')
      .split('/')
      .map(s => s.trim())
      .filter(Boolean)
      .join(' › ');

    let cleanText = (r.text || '').replace(/\r/g, '');
    cleanText = cleanText.replace(/^\[.+?\]\s*/g, '');
    cleanText = cleanText.replace(/^#{2,6}\s+/gm, '');
    cleanText = cleanText.replace(/\*\*(.+?)\*\*/g, '$1');
    cleanText = cleanText.replace(/\*(.+?)\*/g, '$1');
    cleanText = cleanText.replace(/\n{3,}/g, '\n\n').trim();
    const snippet = cleanText.replace(/\n/g, ' ').slice(0, 200);

    item.innerHTML = `
      <div class="rag-item-header">
        <span class="rag-item-index">${i + 1}</span>
        <span class="rag-item-file">${escapeHtml(r.file_name || '未知')}</span>
        <span class="rag-item-score ${scoreClass}">${scorePercent}%</span>
      </div>
      ${cleanSection ? `<div class="rag-item-section">${escapeHtml(cleanSection)}</div>` : ''}
      <div class="rag-item-text">${escapeHtml(snippet)}${cleanText.length > 200 ? '...' : ''}</div>
    `;
    body.appendChild(item);
  });
  container.appendChild(body);
  return container;
}

// 将 RAG 卡片插入到最后一个用户消息之后
function insertRagCard(container) {
  const chatContent = document.getElementById('chat-content');
  const userMsgs = chatContent.querySelectorAll('.message.user');
  const lastUserMsg = userMsgs[userMsgs.length - 1];
  if (lastUserMsg) {
    lastUserMsg.insertAdjacentElement('afterend', container);
  } else {
    chatContent.appendChild(container);
  }
}

function showRagResults(results) {
  console.log('[RAG-UI] showRagResults called, results:', results?.length);
  if (!results || results.length === 0) { console.log('[RAG-UI] no results, returning'); return; }
  try {
    const welcome = document.getElementById('welcome');
    if (welcome) welcome.style.display = 'none';
    if (currentStreamBubble) {
      ragResultsCache[currentStreamBubble] = results;
    }
    const container = buildRagCard(results);
    insertRagCard(container);
    console.log('[RAG-UI] card inserted successfully');
  } catch(e) {
    console.error('[RAG-UI] build/insert failed:', e);
    // 降级：至少插入一个简单的提示条
    const el = document.createElement('div');
    el.className = 'tool-status';
    el.innerHTML = `检索到 ${results.length} 条参考资料（卡片渲染失败：${e.message}）`;
    document.getElementById('chat-content').appendChild(el);
  }
  scrollToBottom();
}

// 刷新页面后恢复 RAG 卡片
function restoreRagCard(assistId, results) {
  const container = buildRagCard(results);
  const chatContent = document.getElementById('chat-content');
  const assistBubble = document.getElementById(assistId);
  if (assistBubble && assistBubble.parentNode === chatContent) {
    chatContent.insertBefore(container, assistBubble);
  } else {
    chatContent.appendChild(container);
  }
}

function renderMarkdown(text) {
  if (!text) return '';
  const mathBlocks = [];
  let processed = text;
  processed = processed.replace(/\$\$([\s\S]*?)\$\$/g, (_, f) => { const id = `MATHBLOCK_${mathBlocks.length}`; mathBlocks.push({type:'block',formula:f.trim()}); return id; });
  processed = processed.replace(/(?<!\$)\$(?!\$)([^\$\n]+?)\$(?!\$)/g, (_, f) => { const id = `MATHINLINE_${mathBlocks.length}`; mathBlocks.push({type:'inline',formula:f.trim()}); return id; });
  let html;
  try { html = marked.parse(processed, { breaks: true, gfm: true }); } catch (e) { html = escapeHtml(processed); }
  mathBlocks.forEach((b,i) => {
    const id = b.type==='block'?`MATHBLOCK_${i}`:`MATHINLINE_${i}`;
    try { html = html.replace(id, katex.renderToString(b.formula, {displayMode:b.type==='block',throwOnError:false,trust:true})); } catch (e) { html = html.replace(id, `<code>${escapeHtml(b.formula)}</code>`); }
  });
  const doc = new DOMParser().parseFromString(html, 'text/html');
  doc.querySelectorAll('pre code').forEach(block => {
    if (block.className) {
      try { const r = hljs.highlight(block.textContent, {language: block.className.replace('language-','')||'plaintext'}); block.innerHTML = r.value; block.classList.add('hljs'); } catch(e) { block.classList.add('hljs'); }
    } else { block.classList.add('hljs'); }
  });
  return doc.body.innerHTML;
}

function addCopyButton(pre) {
  if (pre.querySelector('.copy-btn')) return;
  const btn = document.createElement('button');
  btn.className = 'copy-btn'; btn.textContent = '复制';
  btn.onclick = async () => {
    const code = pre.querySelector('code')?.textContent || '';
    try { await navigator.clipboard.writeText(code); btn.textContent = '已复制'; btn.classList.add('copied'); setTimeout(()=>{btn.textContent='复制';btn.classList.remove('copied');},2000); }
    catch { btn.textContent = '失败'; setTimeout(()=>{btn.textContent='复制';},2000); }
  };
  pre.appendChild(btn);
}

async function sendMessage() {
  const input = document.getElementById('message-input');
  const message = input.value.trim();
  if (!message || isStreaming) return;
  input.value = ''; input.style.height = 'auto';
  isStreaming = true; updateSendButton();
  if (!sessionId) {
    try {
      const res = await fetch('/api/session', { method:'POST' });
      if (!res.ok) throw new Error();
      const d = await res.json();
      sessionId = d.sessionId;
      try { localStorage.setItem('chat_sessionId', sessionId); } catch(e) {}
    } catch { showStatus('无法连接服务器', true); isStreaming=false; updateSendButton(); return; }
  }
  const settings = JSON.parse(localStorage.getItem('chat_settings')||'{}');
  const model = settings.model || 'claude-sonnet-4-6';
  const userMsgId = appendMessage('user', message);
  messages.push({ role:'user', content:message, id:userMsgId }); saveToStorage();
  const assistId = `msg_${Date.now()}_assist`; currentStreamBubble = assistId;
  appendMessage('assistant', '', false, assistId);
  const bubble = document.getElementById(assistId)?.querySelector('.bubble');
  if (bubble) bubble.classList.add('streaming-cursor');
  let fullContent = ''; let activeToolDiv = null;
  try {
    const resp = await fetch('/api/chat', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({message, sessionId, model}) });
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    const reader = resp.body.getReader(); const decoder = new TextDecoder(); let buffer = '';
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, {stream:true});
      let idx;
      while ((idx = buffer.indexOf('\n')) !== -1) {
        const line = buffer.slice(0,idx).trim(); buffer = buffer.slice(idx+1);
        if (!line.startsWith('data: ')) continue;
        const data = line.slice(6); if (data === '[DONE]') continue;
        try {
          const ev = JSON.parse(data);
          console.log('[SSE] event type:', ev.type);
          switch (ev.type) {
            case 'text': fullContent += ev.text; if(bubble){bubble.innerHTML=renderMarkdown(fullContent);bubble.querySelectorAll('pre').forEach(addCopyButton);} scrollToBottom(); break;
            case 'rag_results':
              try {
                showRagResults(ev.results);
              } catch(e) { console.error('[RAG-UI] showRagResults error:', e); }
              break;
            case 'tool_start': activeToolDiv = appendToolStatus(ev.name, ev.input); break;
            case 'tool_end': if(activeToolDiv){finishToolStatus(activeToolDiv);activeToolDiv=null;} break;
            case 'status':  break;
            case 'done': hideStatus(); if(ev.sessionId&&ev.sessionId!==sessionId){sessionId=ev.sessionId;try{localStorage.setItem('chat_sessionId',sessionId);}catch(e){};} break;
            case 'error': showStatus(ev.message,true); fullContent+=`\n\n> 错误：${ev.message}`; if(bubble)bubble.innerHTML=renderMarkdown(fullContent); break;
          }
        } catch(e){ console.warn('[SSE] event parse error:', e); }
      }
    }
  } catch(err) {
    fullContent += `\n\n> 网络错误: ${err.message}`;
    if(bubble) bubble.innerHTML = renderMarkdown(fullContent);
    showStatus('连接失败，请确认 server.js 已启动', true);
  }
  if (bubble) bubble.classList.remove('streaming-cursor');
  if (fullContent) { updateBubbleText(assistId, fullContent); messages.push({role:'assistant',content:fullContent,id:assistId}); saveToStorage(); }
  else { const el = document.getElementById(assistId); if(el) el.remove(); }
  currentStreamBubble = null; isStreaming = false; updateSendButton();
  document.getElementById('message-input').focus();
}

function sendHint(t) { document.getElementById('message-input').value = t; sendMessage(); }
function autoResize(el) { el.style.height='auto'; el.style.height=Math.min(el.scrollHeight,150)+'px'; }

function scrollToBottom() {
  const area = document.getElementById('chat-area');
  requestAnimationFrame(() => {
    area.scrollTop = area.scrollHeight;
  });
}

function updateSendButton() { const b=document.getElementById('send-btn'); b.disabled=isStreaming; }
function showStatus(t,e) { const bar=document.getElementById('status-bar'); bar.textContent=t; bar.classList.add('visible'); bar.classList.toggle('error',e); }
function hideStatus() { const bar=document.getElementById('status-bar'); bar.classList.remove('visible','error'); bar.textContent=''; }
function openSettings() { document.getElementById('settings-modal').classList.add('open'); }
function closeSettings() { document.getElementById('settings-modal').classList.remove('open'); }
function saveSettings() {
  localStorage.setItem('chat_settings', JSON.stringify({ model: document.getElementById('setting-model').value, api: document.getElementById('setting-api').value }));
  closeSettings(); showStatus('设置已保存'); setTimeout(hideStatus,2500);
}
document.getElementById('btn-settings').addEventListener('click', openSettings);

function clearHistory() {
  messages=[]; sessionId=null; ragResultsCache = {};
  localStorage.removeItem('chat_messages'); localStorage.removeItem('chat_sessionId'); localStorage.removeItem('chat_ragResults');
  // 重置 chat-content 内容
  document.getElementById('chat-content').innerHTML = `
    <div class="welcome" id="welcome">
      <div class="welcome-icon"><svg width="42" height="42" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/></svg></div>
      <h2>今天想了解什么？</h2>
      <p class="welcome-sub">电力电子教学助手，随时为你解答</p>
      <div class="hints">
        <button class="hint-chip" onclick="sendHint('什么是单相桥式整流电路？')">单相桥式整流</button>
        <button class="hint-chip" onclick="sendHint('Buck电路的工作原理')">Buck电路</button>
        <button class="hint-chip" onclick="sendHint('SPWM的调制原理')">SPWM调制</button>
        <button class="hint-chip" onclick="sendHint('IGBT和MOSFET的区别')">IGBT vs MOSFET</button>
        <button class="hint-chip" onclick="sendHint('帮我分析boost电路的纹波')">Boost纹波分析</button>
      </div>
    </div>`;
  closeSettings();
}
document.getElementById('btn-clear').addEventListener('click', ()=>{ if(confirm('清空当前对话？')) clearHistory(); });

