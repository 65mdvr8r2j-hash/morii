(() => {
  'use strict';
  const data = window.MORII;
  if (!data) return;
  const $ = (s, root = document) => root.querySelector(s);
  const $$ = (s, root = document) => Array.from(root.querySelectorAll(s));
  const escape = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const icon = name => `<svg class="icon" aria-hidden="true"><use href="#i-${name}"/></svg>`;
  const safeLink = value => {
    if (!value) return '';
    try { const url = new URL(value); return url.protocol === 'https:' ? url.href : ''; }
    catch { return ''; }
  };
  const safeImage = value => {
    if (!value) return 'assets/camera-placeholder.svg';
    if (/^assets\/[a-zA-Z0-9_./-]+$/.test(value) && !value.includes('..')) return value;
    return safeLink(value) || 'assets/camera-placeholder.svg';
  };
  const names = {rentLine:'LINE เช่ากล้อง',buyLine:'LINE ซื้อกล้อง',tiktok:'TikTok',instagram:'Instagram',x:'X'};
  const cameras = data.cameras || [];
  const cameraDialog = $('#camera-dialog');
  const lightbox = $('#lightbox');
  let currentCamera = null;
  let filter = 'all';
  let activeGallery = 'samples';
  let galleryItems = [];
  let photoIndex = 0;
  let openedViaCard = false;
  let returnFocus = null;
  let toastTimer;

  function toast(message) {
    const el = $('#toast');
    clearTimeout(toastTimer);
    el.textContent = message;
    el.classList.add('visible');
    toastTimer = setTimeout(() => el.classList.remove('visible'), 2800);
  }
  function syncScrollLock() { document.body.classList.toggle('modal-open', !!$('dialog[open]')); }
  function show(dialog) { if (!dialog.open) dialog.showModal(); syncScrollLock(); }
  function fallbackImages(root = document) {
    $$('img', root).forEach(img => img.addEventListener('error', () => {
      if (!img.dataset.fallback) { img.dataset.fallback = 'true'; img.src = 'assets/camera-placeholder.svg'; }
    }));
  }
  function setExternal(el, url) {
    el.href = url;
    el.target = '_blank';
    el.rel = 'noopener noreferrer';
    el.removeAttribute('role');
    el.removeAttribute('tabindex');
  }
  const queueUrl = data.queue?.linkType === 'view' ? safeLink(data.queue.url) : '';
  $$('[data-queue]').forEach(el => {
    if (queueUrl && /(^|\.)canva\.(com|link)$/.test(new URL(queueUrl).hostname)) setExternal(el, queueUrl);
    else { el.removeAttribute('href'); el.setAttribute('role','button'); el.tabIndex=0; el.addEventListener('click', () => showNotice('ตารางคิวกำลังอัปเดต', 'ร้านกำลังเตรียมลิงก์ตารางคิว กรุณาสอบถามวันว่างกับร้านอีกครั้งค่ะ')); }
  });
  if (safeLink(data.albumUrl)) setExternal($('#shop-album'), safeLink(data.albumUrl));
  $('#draft-note').hidden = !data.preview;
  $('#year').textContent = new Date().getFullYear();
  $('#catalog-total').textContent = `${cameras.length} รุ่นให้เลือก`;

  function showNotice(title, description) {
    $('#notice-title').textContent = title;
    $('#notice-text').textContent = description;
    show($('#notice-dialog'));
  }
  function configureContacts() {
    $$('[data-contact]').forEach(el => {
      const key = el.dataset.contact;
      const url = safeLink(data.contacts[key]);
      if (url) { setExternal(el, url); return; }
      el.removeAttribute('href');
      el.setAttribute('role','button');
      el.setAttribute('aria-haspopup','dialog');
      el.tabIndex=0;
      el.addEventListener('click', () => showNotice(`${names[key]} กำลังมา`, 'เว็บตัวอย่างนี้ยังไม่ได้ใส่ลิงก์ช่องทางติดต่อของร้าน ส่วนตารางคิวและอัลบั้ม Canva เปิดดูได้แล้วค่ะ'));
      el.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); el.click(); } });
    });
  }
  configureContacts();

  function renderCameras() {
    const query = $('#camera-search').value.trim().toLowerCase().replace(/\s+/g,'');
    const visible = cameras.filter(c => (filter === 'all' || c.family === filter) && c.name.toLowerCase().replace(/\s+/g,'').includes(query));
    $('#camera-grid').innerHTML = visible.map(c => `<article class="camera-card"><button class="camera-open" type="button" data-camera="${escape(c.id)}" aria-haspopup="dialog" aria-label="ดูภาพและรายละเอียด ${escape(c.name)}"><div class="camera-picture" style="background:${escape(c.color)}"><span class="camera-series">${escape(c.family)} SERIES</span><img src="${escape(safeImage(c.image))}" alt="${escape(c.name)} ภาพประกอบรุ่นจากผู้ผลิต" width="400" height="300" loading="lazy"><span class="camera-open-arrow">${icon('external')}</span></div><div class="camera-meta"><h3>${escape(c.name)}</h3><p>${escape(c.note)}</p><div class="camera-bottom"><span>${icon('image')}ภาพ &amp; รีวิว</span><span class="card-cta">ดูรายละเอียด${icon('arrow')}</span></div></div></button></article>`).join('');
    $('#no-results').hidden = visible.length > 0;
    $('#search-status').textContent = `พบกล้อง ${visible.length} รุ่น`;
    fallbackImages($('#camera-grid'));
    $$('[data-camera]').forEach(button => button.addEventListener('click', () => {
      returnFocus = button;
      openedViaCard = true;
      history.pushState({camera:button.dataset.camera},'',`#camera=${encodeURIComponent(button.dataset.camera)}`);
      openCamera(button.dataset.camera);
    }));
  }
  $$('.filter').forEach(button => button.addEventListener('click', () => {
    filter = button.dataset.filter;
    $$('.filter').forEach(b => { b.classList.toggle('active', b === button); b.setAttribute('aria-pressed',String(b === button)); });
    renderCameras();
  }));
  $('#camera-search').addEventListener('input', renderCameras);
  $('#reset-search').addEventListener('click', () => {
    $('#camera-search').value=''; filter='all';
    $$('.filter').forEach(b => { b.classList.toggle('active',b.dataset.filter==='all');b.setAttribute('aria-pressed',String(b.dataset.filter==='all')); });
    renderCameras(); $('#camera-search').focus();
  });

  function openCamera(id) {
    const camera = cameras.find(c => c.id === id);
    if (!camera) return;
    currentCamera = camera;
    activeGallery = 'samples';
    document.title = `${camera.name} — morii`;
    $('#detail-image').src = safeImage(camera.image);
    $('#detail-image').alt = `${camera.name} ภาพประกอบรุ่นจากผู้ผลิต`;
    delete $('#detail-image').dataset.fallback;
    $('#detail-product').style.background = camera.color;
    $('#detail-family').textContent = `CANON · ${camera.family} SERIES`;
    $('#detail-title').textContent = camera.name;
    $('#detail-note').textContent = camera.note;
    $('#tab-samples').textContent = `ภาพจากกล้อง (${camera.samples?.length || 0})`;
    $('#tab-reviews').textContent = `รีวิวลูกค้า (${camera.reviews?.length || 0})`;
    $('#tab-reviews').hidden = !camera.reviews?.length;
    $('#booking-message').textContent = `สวัสดีค่ะ สนใจเช่า ${camera.name} ช่วงวันที่ ___ ถึง ___ ยังมีคิวว่างไหมคะ ขอทราบราคาและรายละเอียดการเช่าค่ะ`;
    renderGallery();
    show(cameraDialog);
    cameraDialog.scrollTop=0;
  }
  function closeCamera() {
    if (lightbox.open) lightbox.close();
    cameraDialog.close();
    document.title = 'morii — เช่ากล้อง เก็บวันดี ๆ ไว้ด้วยกัน';
    if (location.hash.startsWith('#camera=')) {
      if (openedViaCard) history.back();
      else history.replaceState(null,'','#cameras');
    }
    openedViaCard=false;
    syncScrollLock();
    returnFocus?.focus({preventScroll:true});
  }
  function syncRoute() {
    const match = location.hash.match(/^#camera=([^&]+)$/);
    if (match) {
      let id;
      try { id=decodeURIComponent(match[1]); } catch { return; }
      if (!cameraDialog.open || currentCamera?.id !== id) openCamera(id);
    } else if (cameraDialog.open) {
      if (lightbox.open) lightbox.close();
      cameraDialog.close();
      document.title = 'morii — เช่ากล้อง เก็บวันดี ๆ ไว้ด้วยกัน';
      openedViaCard=false;
      syncScrollLock();
    }
  }
  window.addEventListener('hashchange', syncRoute);

  function renderGallery() {
    const isSamples = activeGallery === 'samples';
    $$('.gallery-tab').forEach(b => {
      const selected=b.dataset.gallery===activeGallery;
      b.classList.toggle('active',selected);
      b.setAttribute('aria-selected',String(selected));
      b.tabIndex=selected?0:-1;
    });
    $('#gallery-panel').setAttribute('aria-labelledby',`tab-${activeGallery}`);
    galleryItems = Array.isArray(currentCamera[activeGallery]) ? currentCamera[activeGallery] : [];
    if (!galleryItems.length) {
      $('#gallery-panel').innerHTML = `<div class="gallery-empty">${icon(isSamples?'image':'heart')}<h3>${isSamples?'ภาพจากกล้องรุ่นนี้กำลังมา':'รอรวบรวมรีวิวของรุ่นนี้'}</h3><p>${isSamples?'ร้านกำลังเตรียมภาพที่ถ่ายด้วยกล้องรุ่นนี้ ระหว่างนี้แวะดูอัลบั้มรวมของ morii ได้ค่ะ':'เมื่อร้านเพิ่มภาพจากลูกค้าของกล้องรุ่นนี้ จะเปิดดูรูปขยายได้ที่นี่ค่ะ'}</p>${safeLink(data.albumUrl)?`<a class="text-link" href="${escape(safeLink(data.albumUrl))}" target="_blank" rel="noopener noreferrer">เปิดอัลบั้มรวมของร้าน${icon('external')}</a>`:''}</div>`;
      return;
    }
    const albumUrl = safeLink(currentCamera.albumUrl || data.albumUrl);
    $('#gallery-panel').innerHTML=`<div class="gallery-summary"><p>${galleryItems.length} ภาพ · แตะรูปเพื่อดูภาพขยาย</p>${albumUrl?`<a class="text-link" href="${escape(albumUrl)}" target="_blank" rel="noopener noreferrer">อัลบั้มรุ่นนี้${icon('external')}</a>`:''}</div><div class="gallery-grid">${galleryItems.map((photo,index)=>`<button type="button" class="gallery-image" data-photo="${index}" aria-label="เปิดภาพ ${index+1}: ${escape(photo.alt||photo.caption||currentCamera.name)}"><img src="${escape(safeImage(photo.thumbnail || photo.src))}" alt="${escape(photo.alt||photo.caption||currentCamera.name)}" loading="lazy" decoding="async" width="480" height="360"><span>${escape(photo.caption||`ภาพที่ ${index+1}`)}</span></button>`).join('')}</div>`;
    fallbackImages($('#gallery-panel'));
    $$('[data-photo]').forEach(button=>button.addEventListener('click',()=>{photoIndex=Number(button.dataset.photo);renderLightbox();show(lightbox);}));
  }
  $$('.gallery-tab').forEach(button => {
    button.addEventListener('click',()=>{activeGallery=button.dataset.gallery;renderGallery();});
    button.addEventListener('keydown',event=>{
      if (!['ArrowLeft','ArrowRight','Home','End'].includes(event.key)) return;
      event.preventDefault();
      const tabs=$$('.gallery-tab').filter(tab=>!tab.hidden);
      const current=tabs.findIndex(tab=>tab.dataset.gallery===activeGallery);
      const next=event.key==='Home'?0:event.key==='End'?tabs.length-1:(current+(event.key==='ArrowRight'?1:-1)+tabs.length)%tabs.length;
      activeGallery=tabs[next].dataset.gallery;
      renderGallery(); $(`#tab-${activeGallery}`).focus();
    });
  });
  function renderLightbox() {
    const photo=galleryItems[photoIndex];
    if (!photo) return;
    delete $('#lightbox-image').dataset.fallback;
    $('#lightbox-image').src=safeImage(photo.src);
    $('#lightbox-image').alt=photo.alt||photo.caption||currentCamera.name;
    $('#lightbox-caption').textContent=[photo.caption,photo.credit].filter(Boolean).join(' · ');
    $('#lightbox-count').textContent=`${photoIndex+1} / ${galleryItems.length}`;
    $('#photo-prev').hidden=galleryItems.length<2;
    $('#photo-next').hidden=galleryItems.length<2;
  }
  function movePhoto(direction) { if (galleryItems.length) {photoIndex=(photoIndex+direction+galleryItems.length)%galleryItems.length;renderLightbox();} }
  $('#photo-prev').addEventListener('click',()=>movePhoto(-1));
  $('#photo-next').addEventListener('click',()=>movePhoto(1));
  lightbox.addEventListener('keydown',e=>{if(e.key==='ArrowLeft'){e.preventDefault();movePhoto(-1);}if(e.key==='ArrowRight'){e.preventDefault();movePhoto(1);}});

  async function copyText(value) {
    try {
      if (!navigator.clipboard?.writeText) throw new Error('Clipboard unavailable');
      await navigator.clipboard.writeText(value);
      toast('คัดลอกแล้วค่ะ ♡');
    } catch {
      // A selectable field keeps the action usable when clipboard permission is denied.
      showNotice('คัดลอกข้อความ',value);
      const selection=window.getSelection();
      const range=document.createRange();range.selectNodeContents($('#notice-text'));
      selection?.removeAllRanges();selection?.addRange(range);
    }
  }
  $('#copy-booking').addEventListener('click',()=>copyText($('#booking-message').textContent));
  $('#share-camera').addEventListener('click',()=>{if(currentCamera)copyText(`${location.origin}${location.pathname}#camera=${encodeURIComponent(currentCamera.id)}`);});
  $$('[data-close]').forEach(button=>button.addEventListener('click',()=>{
    const dialog=document.getElementById(button.dataset.close);
    if(dialog===cameraDialog)closeCamera();else{dialog.close();syncScrollLock();}
  }));
  $$('dialog').forEach(dialog=>{
    dialog.addEventListener('close',syncScrollLock);
    dialog.addEventListener('cancel',e=>{if(dialog===cameraDialog){e.preventDefault();closeCamera();}});
    dialog.addEventListener('click',event=>{
      if(event.target!==dialog)return;
      const bounds=dialog.getBoundingClientRect();
      if(event.clientX<bounds.left||event.clientX>bounds.right||event.clientY<bounds.top||event.clientY>bounds.bottom){
        if(dialog===cameraDialog)closeCamera();else{dialog.close();syncScrollLock();}
      }
    });
  });
  fallbackImages();
  renderCameras();
  syncRoute();
})();
