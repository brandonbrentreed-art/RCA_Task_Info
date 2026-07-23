"use strict";

// ============================================================
// ndc-app.js — NDC Task Allocation page controller
// Extracted from ndc.html inline script block.
// ============================================================

(function () {
  var content = document.getElementById('ndcContent');
  var columns = [
    { key: 'OrderRef', label: 'Order Reference' },
    { key: 'EngId', label: 'Engineer ID' },
    { key: 'Status', label: 'Status' },
    { key: 'SubmittedBy', label: 'Submitted By' },
    { key: 'NdcStatus', label: 'NDC Status' },
    { key: 'TfStatus', label: 'Taskforce Status' },
    { key: 'Matched', label: 'Matched' },
    { key: 'TfEngId', label: 'Taskforce Engineer' },
    { key: 'DateProcessed', label: 'Date Processed' }
  ];
  var sampleCurrent = [
    { OrderRef:'B1-26636097A', EngId:'abc1234', Status:'Pending', SubmittedBy:'System', NdcStatus:'Queued', TfStatus:'Awaiting', Matched:'No', TfEngId:'\u2014', DateProcessed:'\u2014' },
    { OrderRef:'B6-27209822A', EngId:'def5678', Status:'Processing', SubmittedBy:'System', NdcStatus:'Sent', TfStatus:'Pending', Matched:'No', TfEngId:'\u2014', DateProcessed:'\u2014' }
  ];
  var sampleCompleted = [
    { OrderRef:'B1-26500001A', EngId:'ghi9012', Status:'Complete', SubmittedBy:'System', NdcStatus:'Allocated', TfStatus:'Matched', Matched:'Yes', TfEngId:'jkl3456', DateProcessed:'2025-01-15 14:32' },
    { OrderRef:'B6-26500002A', EngId:'mno7890', Status:'Complete', SubmittedBy:'System', NdcStatus:'Allocated', TfStatus:'Matched', Matched:'Yes', TfEngId:'pqr1234', DateProcessed:'2025-01-15 16:45' }
  ];

  var uploadedRows = [];
  var page = 0;
  var pageSize = 30;
  var pageSizeOptions = [30, 60, 90];
  var defaultHTML = content.innerHTML;
  var defaultClass = content.className;
  var PIN_REGEX = /^[A-Za-z0-9]{5,8}$/;

  function validatePins() {
    var inputs = content.querySelectorAll('.ndc-edit-input');
    var submitBtn = document.getElementById('ndcSubmit');
    if (!submitBtn) return;
    var allValid = true;
    inputs.forEach(function (input) {
      var valid = PIN_REGEX.test(input.value.trim());
      input.classList.toggle('ndc-edit-input--invalid', !valid);
      if (!valid) allValid = false;
    });
    submitBtn.disabled = !allValid;
    submitBtn.style.opacity = allValid ? '1' : '0.5';
    submitBtn.style.cursor = allValid ? 'pointer' : 'not-allowed';
    submitBtn.style.pointerEvents = 'auto';
    if (!allValid) {
      submitBtn.classList.add('tooltip-top');
      submitBtn.setAttribute('data-tooltip', 'Each task must have a valid WM Pin');
    } else {
      submitBtn.classList.remove('tooltip-top');
      submitBtn.removeAttribute('data-tooltip');
    }
  }

  function showDefault() {
    content.className = defaultClass;
    content.innerHTML = defaultHTML;
    document.getElementById('btnUpload').addEventListener('click', function () { if (!isCutoff()) fileInput.click(); });
    document.getElementById('btnCurrent').addEventListener('click', function () { tablePage = 0; showTable('Current Requests', sampleCurrent); });
    document.getElementById('btnCompleted').addEventListener('click', function () { tablePage = 0; showTable('Completed Requests', sampleCompleted); });
    document.getElementById('downloadTemplate').addEventListener('click', function (e) {
      e.preventDefault();
      if (typeof XLSX === 'undefined') { Notify.warning('Template library still loading, try again in a moment.', 2000); return; }
      var wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([['Task ID', 'Tech ID']]), 'Template');
      XLSX.writeFile(wb, 'NDC_Allocation_Template.xlsx');
    });
    content.querySelectorAll('a[href]').forEach(function (link) {
      var href = link.getAttribute('href');
      link.dataset.href = href;
      link.removeAttribute('href');
      link.style.cursor = 'pointer';
      if (href.startsWith('mailto:')) {
        link.addEventListener('click', function (e) { e.preventDefault(); if (typeof Notify !== 'undefined') Notify.info('Opening email client...', 2000); window.location.href = href; });
      } else if (link.getAttribute('target') === '_blank' || href.startsWith('http')) {
        link.addEventListener('click', function (e) { e.preventDefault(); window.open(href, '_blank'); });
      }
    });
    var btn = document.querySelector('.search-toggle');
    btn.disabled = true;
    btn.style.opacity = '0.38';
    btn.style.pointerEvents = 'none';
    searchExpand.classList.remove('active', 'has-value');
    searchFilter.value = '';
    updateClock();
  }

  function enableSearch() {
    var btn = document.querySelector('.search-toggle');
    btn.disabled = false;
    btn.style.opacity = '1';
    btn.style.pointerEvents = 'auto';
  }

  var tableData = [];
  var tablePage = 0;
  var tableTitle = '';

  function showTable(title, data) {
    tableData = data;
    tableTitle = title;
    renderTable();
  }

  function renderTable() {
    enableSearch();
    var data = tableData;
    var title = tableTitle;
    var isCurrent = title === 'Current Requests';
    var start = tablePage * pageSize;
    var pageRows = data.slice(start, start + pageSize);

    var backBtn = '<button class="ndc-back" id="ndcBack"><svg viewBox="0 0 24 24" fill="currentColor"><path d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z"/></svg> Back</button>';
    var h = '<div class="table-wrapper--flex"><div class="table-scroll"><table class="table"><thead><tr>';
    if (isCurrent) h += '<th style="text-align:center;width:60px">Remove Record</th>';
    columns.forEach(function (c) { h += '<th>' + c.label + '</th>'; });
    h += '</tr></thead><tbody>';
    if (!pageRows.length) {
      h += '<tr><td colspan="' + (columns.length + (isCurrent ? 1 : 0)) + '" class="ndc-empty">No records found</td></tr>';
    } else {
      pageRows.forEach(function (r, idx) {
        h += '<tr>';
        if (isCurrent) {
          h += '<td style="text-align:center;width:60px"><button class="ndc-row-remove" data-idx="' + (start + idx) + '"><svg viewBox="0 0 24 24" fill="currentColor"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg></button></td>';
        }
        columns.forEach(function (c, i) {
          if (i === 0) {
            h += '<td><span class="pivot-row-id"><span>' + (r[c.key] || '\u2014') + '</span><button class="pivot-copy" aria-label="Copy" data-copy="' + r[c.key] + '"><svg viewBox="0 0 24 24" fill="currentColor"><path d="M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z"/></svg></button></span></td>';
          } else {
            h += '<td>' + (r[c.key] || '\u2014') + '</td>';
          }
        });
        h += '</tr>';
      });
    }
    h += '</tbody></table></div><div id="tablePaginationSlot"></div></div>';
    content.classList.add('ndc-content--table');
    content.innerHTML = '<div class="ndc-section"><h3>' + title + '</h3>' + backBtn + h + '</div>';

    document.getElementById('tablePaginationSlot').appendChild(
      Pagination.create(data.length, tablePage, pageSize, pageSizeOptions,
        function (p) { tablePage = p; renderTable(); },
        function (s) { pageSize = s; tablePage = 0; renderTable(); }
      )
    );

    document.getElementById('ndcBack').addEventListener('click', showDefault);
    content.querySelectorAll('.pivot-copy').forEach(function (btn) {
      btn.addEventListener('click', function () {
        navigator.clipboard.writeText(btn.dataset.copy).then(function () {
          btn.innerHTML = '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg>';
          btn.classList.add('pivot-copy--done');
          setTimeout(function () {
            btn.classList.add('pivot-copy--fade');
            setTimeout(function () {
              btn.innerHTML = '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z"/></svg>';
              btn.classList.remove('pivot-copy--done', 'pivot-copy--fade');
            }, 200);
          }, 600);
        });
      });
    });

    if (isCurrent) {
      content.querySelectorAll('.ndc-row-remove').forEach(function (btn) {
        if (isCutoff()) { btn.disabled = true; btn.style.opacity = '0.38'; btn.style.cursor = 'not-allowed'; return; }
        btn.addEventListener('click', async function () {
          var idx = parseInt(btn.dataset.idx);
          var ref = tableData[idx].OrderRef;
          var confirmed = await Dialog.confirm({ title: 'Remove Record', message: 'Cancel request ' + ref + '?', confirmText: 'Remove', type: 'primary' });
          if (confirmed) {
            tableData.splice(idx, 1);
            if (tablePage >= Math.ceil(tableData.length / pageSize)) tablePage = Math.max(0, Math.ceil(tableData.length / pageSize) - 1);
            renderTable();
            Notify.success('Request ' + ref + ' cancelled.');
          }
        });
      });
    }
    filterRows();
  }

  function showUploadPreview(filename) {
    var start = page * pageSize;
    var rows = uploadedRows.slice(start, start + pageSize);
    var cols = Object.keys(uploadedRows[0] || {}).filter(function (k) { return k !== '_id'; });
    var backBtn = '<button class="ndc-back" id="ndcBack"><svg viewBox="0 0 24 24" fill="currentColor"><path d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z"/></svg> Back</button>';
    var h = '<div class="ndc-upload-preview">';
    h += '<div class="ndc-upload-file"><strong>' + filename + '</strong><span>' + uploadedRows.length + ' row' + (uploadedRows.length !== 1 ? 's' : '') + '</span></div>';
    h += '<div class="table-wrapper--flex"><div class="table-scroll"><table class="table"><thead><tr>';
    h += '<th style="text-align:center;width:60px">Remove Record</th>';
    cols.forEach(function (c) { h += '<th>' + c + '</th>'; });
    h += '</tr></thead><tbody>';
    rows.forEach(function (r) {
      h += '<tr data-row-id="' + r._id + '">';
      h += '<td style="text-align:center;width:60px"><button class="ndc-row-remove" data-row-id="' + r._id + '"><svg viewBox="0 0 24 24" fill="currentColor"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg></button></td>';
      cols.forEach(function (c) {
        if (c === 'WM Pin' || c === 'Tech ID') {
          h += '<td><input class="ndc-edit-input" type="text" value="' + (r[c] || '') + '" data-row-id="' + r._id + '" data-col="' + c + '"></td>';
        } else if (c === 'Task ID' || c === 'JIN ID') {
          h += '<td><span class="pivot-row-id"><span>' + (r[c] || '\u2014') + '</span><button class="pivot-copy" aria-label="Copy" data-copy="' + r[c] + '"><svg viewBox="0 0 24 24" fill="currentColor"><path d="M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z"/></svg></button></span></td>';
        } else {
          h += '<td>' + (r[c] || '\u2014') + '</td>';
        }
      });
      h += '</tr>';
    });
    h += '</tbody></table></div><div id="paginationSlot"></div></div>';
    h += '<div class="ndc-upload-actions"><button class="btn btn-primary" id="ndcSubmit">Submit Allocation</button><button class="btn btn-outlined" id="ndcCancel">Cancel</button></div>';
    h += '</div>';
    content.classList.add('ndc-content--table');
    content.innerHTML = '<div class="ndc-section"><h3>Upload Preview</h3>' + backBtn + h + '</div>';
    enableSearch();

    document.getElementById('paginationSlot').appendChild(
      Pagination.create(uploadedRows.length, page, pageSize, pageSizeOptions,
        function (p2) { page = p2; showUploadPreview(filename); },
        function (s) { pageSize = s; page = 0; showUploadPreview(filename); }
      )
    );
    document.getElementById('ndcBack').addEventListener('click', showDefault);
    document.getElementById('ndcCancel').addEventListener('click', showDefault);
    var submitBtn = document.getElementById('ndcSubmit');
    validatePins();
    submitBtn.addEventListener('click', async function () {
      var confirmed = await Dialog.confirm({ title: 'Submit Allocation', message: 'Submit ' + uploadedRows.length + ' record' + (uploadedRows.length !== 1 ? 's' : '') + ' for allocation?', confirmText: 'Submit', type: 'primary' });
      if (confirmed) { Notify.success('Allocation submitted successfully.'); showDefault(); }
    });
    content.querySelectorAll('.ndc-row-remove').forEach(function (btn) {
      btn.addEventListener('click', function () {
        uploadedRows = uploadedRows.filter(function (r) { return r._id !== parseInt(btn.dataset.rowId); });
        if (!uploadedRows.length) { showDefault(); return; }
        if (page >= Math.ceil(uploadedRows.length / pageSize)) page = Math.ceil(uploadedRows.length / pageSize) - 1;
        showUploadPreview(filename);
      });
    });
    content.querySelectorAll('.ndc-edit-input').forEach(function (input) {
      input.addEventListener('input', function () {
        input.value = input.value.toUpperCase();
        var row = uploadedRows.find(function (r) { return r._id === parseInt(input.dataset.rowId); });
        if (row) row[input.dataset.col] = input.value;
        validatePins();
      });
    });
    content.querySelectorAll('.pivot-copy').forEach(function (btn) {
      btn.addEventListener('click', function () {
        navigator.clipboard.writeText(btn.dataset.copy).then(function () {
          btn.innerHTML = '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg>';
          btn.classList.add('pivot-copy--done');
          setTimeout(function () {
            btn.classList.add('pivot-copy--fade');
            setTimeout(function () {
              btn.innerHTML = '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z"/></svg>';
              btn.classList.remove('pivot-copy--done', 'pivot-copy--fade');
            }, 200);
          }, 600);
        });
      });
    });
    filterRows();
  }

  // File upload
  var fileInput = document.createElement('input');
  fileInput.type = 'file'; fileInput.accept = '.csv,.xls,.xlsx'; fileInput.hidden = true;
  document.body.appendChild(fileInput);
  document.getElementById('btnUpload').addEventListener('click', function () { if (!isCutoff()) fileInput.click(); });
  fileInput.addEventListener('change', function () {
    var file = fileInput.files[0]; if (!file) return;
    if (typeof XLSX === 'undefined' && !file.name.endsWith('.csv')) { Notify.warning('Excel library still loading, try again in a moment.', 2000); fileInput.value = ''; return; }
    var reader = new FileReader();
    reader.onload = function (e) {
      var dataRows;
      if (file.name.endsWith('.csv')) {
        var lines = e.target.result.trim().split('\n');
        var headers = lines[0].split(',').map(function (h) { return h.trim(); });
        dataRows = lines.slice(1).map(function (l) {
          var v = l.split(',');
          var o = {};
          headers.forEach(function (h, i) { o[h] = (v[i] || '').trim(); });
          return o;
        });
      } else {
        var wb = XLSX.read(new Uint8Array(e.target.result), { type: 'array' });
        dataRows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { defval: '' });
      }
      uploadedRows = dataRows.map(function (r, i) {
        var o = Object.assign({ _id: i }, r);
        if (o['WM Pin']) o['WM Pin'] = o['WM Pin'].toUpperCase();
        return o;
      });
      page = 0;
      showUploadPreview(file.name);
    };
    if (file.name.endsWith('.csv')) reader.readAsText(file); else reader.readAsArrayBuffer(file);
    fileInput.value = '';
  });

  document.getElementById('btnCurrent').addEventListener('click', function () { tablePage = 0; showTable('Current Requests', sampleCurrent); });
  document.getElementById('btnCompleted').addEventListener('click', function () { tablePage = 0; showTable('Completed Requests', sampleCompleted); });

  // Search
  var searchToggle = document.querySelector('.search-toggle');
  var searchExpand = document.querySelector('.search-expand');
  var searchFilter = document.getElementById('searchFilter');
  var searchClear = document.getElementById('searchClear');
  searchToggle.addEventListener('click', function () {
    searchExpand.classList.toggle('active');
    if (searchExpand.classList.contains('active')) searchFilter.focus();
    else { searchFilter.value = ''; filterRows(); }
  });
  searchFilter.addEventListener('input', function () { searchExpand.classList.toggle('has-value', searchFilter.value.length > 0); filterRows(); });
  searchFilter.addEventListener('keydown', function (e) { if (e.key === 'Escape') { searchExpand.classList.remove('active', 'has-value'); searchFilter.value = ''; filterRows(); } });
  document.addEventListener('click', function (e) { if (!searchExpand.contains(e.target) && searchExpand.classList.contains('active') && !searchFilter.value.trim()) { searchExpand.classList.remove('active'); filterRows(); } });
  searchClear.addEventListener('click', function () { searchFilter.value = ''; searchFilter.focus(); searchExpand.classList.remove('has-value'); filterRows(); });

  function filterRows() {
    var f = searchFilter.value.trim().toUpperCase();
    content.querySelectorAll('tbody tr').forEach(function (row) {
      row.style.display = (!f || row.textContent.toUpperCase().includes(f)) ? '' : 'none';
    });
  }

  // Live clock + cutoff logic (19:30–08:00 = locked)
  var CUTOFF_HOUR = 19, CUTOFF_MIN = 30, OPEN_HOUR = 8;
  function isCutoff() {
    var now = new Date();
    var h = now.getHours(), m = now.getMinutes();
    return (h > CUTOFF_HOUR || (h === CUTOFF_HOUR && m >= CUTOFF_MIN) || h < OPEN_HOUR);
  }
  function updateClock() {
    var clockEl = document.getElementById('ndcClock');
    var clockItem = clockEl.closest('.ndc-status-item');
    var uploadBtn = document.getElementById('btnUpload');
    clockEl.textContent = new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    var locked = isCutoff();
    document.documentElement.classList.toggle('ndc-locked', locked);
    clockItem.classList.toggle('ndc-status-item--cutoff', locked);
    if (uploadBtn) {
      uploadBtn.disabled = locked;
      uploadBtn.setAttribute('data-tooltip', locked ? 'Submissions closed \u2014 reopens 08:00' : '');
      if (locked) uploadBtn.classList.add('tooltip');
      else { uploadBtn.classList.remove('tooltip'); uploadBtn.removeAttribute('data-tooltip'); }
    }
  }
  updateClock();
  setInterval(updateClock, 1000);

  // Download template
  document.getElementById('downloadTemplate').addEventListener('click', function (e) {
    e.preventDefault();
    if (typeof XLSX === 'undefined') { Notify.warning('Template library still loading, try again in a moment.', 2000); return; }
    var wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([['Task ID', 'Tech ID']]), 'Template');
    XLSX.writeFile(wb, 'NDC_Allocation_Template.xlsx');
  });
})();
