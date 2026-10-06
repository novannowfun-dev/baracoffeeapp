/**
 * ==============================================================================
 * GOOGLE APPS SCRIPT WEBHOOK - BARA COFFEE (MULTI-OUTLET, STOK, KASBON & OMSET)
 * ==============================================================================
 */

function doPost(e) {
  return handleRequest(e);
}

function doGet(e) {
  if (!e || !e.parameter || Object.keys(e.parameter).length === 0) {
    return ContentService.createTextOutput(
      "BARA COFFEE WEBHOOK AKTIF & SIAP MENERIMA DATA!\n\n" +
      "Status: Online\n" +
      "Waktu Server: " + new Date().toLocaleString("id-ID", { timeZone: "Asia/Jakarta" }) + "\n\n" +
      "Mendukung sync: Penjualan (Kedai/Gerobak), Stok Masuk/Keluar, Kasbon Kru, dan Pengeluaran."
    ).setMimeType(ContentService.MimeType.TEXT);
  }
  return handleRequest(e);
}

function handleRequest(e) {
  var lock = LockService.getScriptLock();
  lock.tryLock(10000);

  try {
    var doc = SpreadsheetApp.getActiveSpreadsheet();
    var data = {};

    if (e && e.postData && e.postData.contents) {
      try {
        data = JSON.parse(e.postData.contents);
      } catch (jsonErr) {
        data = e.parameter || {};
      }
    } else if (e && e.parameter) {
      data = e.parameter;
    }

    var syncType = data.sync_type || data.type || "sales";

    // 1. SYNC TRANSAKSI STOK (IN / OUT)
    if (syncType === "stock") {
      var sheetStok = (data.direction === "out") 
        ? getOrCreateSheet(doc, "Stok_Keluar", ["Tanggal", "ID Produk", "Nama Barang", "Kategori", "Satuan", "Kuantiti", "Tujuan/Keterangan", "Penginput", "Waktu Sync"])
        : getOrCreateSheet(doc, "Stok_Masuk", ["Tanggal", "ID Produk", "Nama Barang", "Kategori", "Satuan", "Kuantiti", "Harga Satuan", "Total Belanja", "Tujuan", "Penginput", "Waktu Sync"]);
      
      var timestamp = Utilities.formatDate(new Date(), "Asia/Jakarta", "yyyy-MM-dd HH:mm:ss");

      if (Array.isArray(data.items)) {
        data.items.forEach(function(item) {
          if (data.direction === "out") {
            sheetStok.appendRow([
              data.transaction_date || data.tanggal,
              item.product_id || item.idProduk || "-",
              item.product_name || item.namaBarang,
              item.category || "-",
              item.unit || item.satuan,
              Number(item.quantity || item.kuantiti) || 0,
              data.destination || data.lokasiTujuan || "Kedai",
              data.recorded_by || data.penginput || "Kru",
              timestamp
            ]);
          } else {
            sheetStok.appendRow([
              data.transaction_date || data.tanggal,
              item.product_id || item.idProduk || "-",
              item.product_name || item.namaBarang,
              item.category || "-",
              item.unit || item.satuan,
              Number(item.quantity || item.kuantiti) || 0,
              Number(item.unit_price || item.hargaBeliSatuan) || 0,
              Number(item.total_cost || item.totalBelanja) || 0,
              data.destination || data.lokasiTujuan || "Kedai",
              data.recorded_by || data.penginput || "Kru",
              timestamp
            ]);
          }
        });
      }

      return ContentService.createTextOutput(JSON.stringify({
        status: "success",
        message: "Sinkronisasi Stok Bara Coffee berhasil!"
      })).setMimeType(ContentService.MimeType.JSON);
    }

    // 2. SYNC KASBON KRU
    if (syncType === "kasbon") {
      var sheetKasbon = getOrCreateSheet(doc, "Kasbon", ["Tanggal", "Nama Kru", "Outlet", "Tipe", "Nominal", "Keterangan", "Disetujui Oleh", "Waktu Sync"]);
      var timestamp = Utilities.formatDate(new Date(), "Asia/Jakarta", "yyyy-MM-dd HH:mm:ss");
      sheetKasbon.appendRow([
        data.entry_date || data.tanggal,
        data.staff_name || data.namaKru,
        data.outlet || "Kedai",
        data.type || "kasbon",
        Number(data.amount || data.nominal) || 0,
        data.notes || data.keterangan || "",
        data.approved_by || "Owner",
        timestamp
      ]);
      return ContentService.createTextOutput(JSON.stringify({
        status: "success",
        message: "Kasbon kru berhasil dicatat di Google Sheets!"
      })).setMimeType(ContentService.MimeType.JSON);
    }

    // 3. SYNC PENGELUARAN KAS KECIL / PETTY CASH (TAB SHEET BARU: Buku_Kas_Pengeluaran)
    if (syncType === "petty_cash" || syncType === "expense") {
      var headersExpense = [
        "Tanggal", "Shift", "Kasir", 
        "Nama Barang / Keperluan", "Kategori", "Nominal", 
        "Catatan Shift", "ID Item", "Waktu Sync"
      ];
      var sheetExpense = getOrCreateSheet(doc, "Buku_Kas_Pengeluaran", headersExpense);

      var expDate = String(data.entry_date || data.date || Utilities.formatDate(new Date(), "Asia/Jakarta", "yyyy-MM-dd")).trim();
      var expShift = String(data.shift || "General").trim();
      var expCashier = String(data.cashier_name || "-").trim();
      var expItem = String(data.item_name || "Pengeluaran Kasir").trim();
      var expCategory = String(data.category || "Lain-lain").trim();
      var expAmount = Number(data.amount) || 0;
      var expNotes = String(data.notes || "").trim();
      var expId = String(data.id || "").trim();
      var expTimestamp = Utilities.formatDate(new Date(), "Asia/Jakarta", "yyyy-MM-dd HH:mm:ss");

      var rowExpValues = [
        expDate, expShift, expCashier,
        expItem, expCategory, expAmount,
        expNotes, expId, expTimestamp
      ];

      // Anti-duplikasi buku kas kecil berdasarkan ID Item atau (Tanggal + Item + Nominal)
      var lastRowExp = sheetExpense.getLastRow();
      var updatedExpIndex = -1;

      if (lastRowExp > 1) {
        var expData = sheetExpense.getRange(2, 1, lastRowExp - 1, headersExpense.length).getValues();
        for (var i = 0; i < expData.length; i++) {
          var rDate = String(expData[i][0] || "").trim();
          var rItem = String(expData[i][3] || "").trim();
          var rAmt = Number(expData[i][5]) || 0;
          var rId = String(expData[i][7] || "").trim();

          var matchById = (expId !== "" && rId !== "" && expId === rId);
          var matchByContent = (rDate === expDate && rItem.toLowerCase() === expItem.toLowerCase() && rAmt === expAmount);

          if (matchById || matchByContent) {
            updatedExpIndex = i + 2;
            break;
          }
        }
      }

      if (updatedExpIndex > 0) {
        sheetExpense.getRange(updatedExpIndex, 1, 1, rowExpValues.length).setValues([rowExpValues]);
        return ContentService.createTextOutput(JSON.stringify({
          status: "success",
          action: "updated",
          message: "Nota pengeluaran kas kecil berhasil diperbarui di tab Buku_Kas_Pengeluaran!",
          row: updatedExpIndex
        })).setMimeType(ContentService.MimeType.JSON);
      } else {
        sheetExpense.appendRow(rowExpValues);
        return ContentService.createTextOutput(JSON.stringify({
          status: "success",
          action: "inserted",
          message: "Nota pengeluaran kas kecil berhasil dicatat di tab Buku_Kas_Pengeluaran!",
          row: sheetExpense.getLastRow()
        })).setMimeType(ContentService.MimeType.JSON);
      }
    }

    // 4. DEFAULT: SYNC PENJUALAN / OMSET HARIAN (ANTI-DUPLIKASI / UPSERT)
    var outletTarget = (data.outlet && String(data.outlet).toLowerCase().indexOf("gerobak") !== -1) ? "Penjualan_Gerobak" : "Penjualan_Kedai";
    var headers = [
      "Tanggal", "Outlet", "Shift", "Kasir", 
      "Gross Sales", "Diskon", "Net Sales", 
      "Cash", "QRIS", "EDC", "Delivery/Online", "Transfer", 
      "Modal Awal", "Kas Keluar", "Kas Fisik", "Selisih Kas", 
      "Catatan", "ID Record", "Waktu Submit"
    ];
    var sheetSales = getOrCreateSheet(doc, outletTarget, headers);

    var entryDate = String(data.entry_date || Utilities.formatDate(new Date(), "Asia/Jakarta", "yyyy-MM-dd")).trim();
    var shift = String(data.shift || "General").trim();
    var cashier = data.cashier_name || data.namaKasir || "-";
    var outlet = data.outlet || "Kedai";
    var recordId = String(data.id || "").trim();
    var gross = Number(data.gross_sales) || 0;
    var discount = Number(data.discounts) || 0;
    var net = Number(data.net_sales) || (gross - discount);
    var cash = Number(data.payment_cash || data.tunai) || 0;
    var qris = Number(data.payment_qris || data.qris) || 0;
    var edc = Number(data.payment_edc || data.edc) || 0;
    var delivery = Number(data.payment_delivery || data.grabOnline || data.grab) || 0;
    var transfer = Number(data.payment_transfer) || 0;
    var opening = Number(data.opening_cash) || 0;
    var petty = Number(data.petty_cash_out) || 0;
    var actual = Number(data.actual_cash) || 0;
    var diff = Number(data.cash_difference) || 0;
    var notes = data.notes || "";
    var timestamp = Utilities.formatDate(new Date(), "Asia/Jakarta", "yyyy-MM-dd HH:mm:ss");

    var rowValues = [
      entryDate, outlet, shift, cashier,
      gross, discount, net,
      cash, qris, edc, delivery, transfer,
      opening, petty, actual, diff,
      notes, recordId, timestamp
    ];

    // Logika Anti-Duplikasi: Cek apakah Tanggal + Shift (atau ID Record) sudah ada di sheet
    var lastRow = sheetSales.getLastRow();
    var updatedRowIndex = -1;

    if (lastRow > 1) {
      var existingData = sheetSales.getRange(2, 1, lastRow - 1, Math.max(headers.length, 18)).getValues();
      for (var r = 0; r < existingData.length; r++) {
        var rowDate = String(existingData[r][0] || "").trim();
        var rowShift = String(existingData[r][2] || "").trim();
        var rowId = String(existingData[r][17] || "").trim();

        var matchById = (recordId !== "" && rowId !== "" && recordId === rowId);
        var matchByDateShift = (rowDate === entryDate && rowShift.toLowerCase() === shift.toLowerCase());

        if (matchById || matchByDateShift) {
          updatedRowIndex = r + 2;
          break;
        }
      }
    }

    if (updatedRowIndex > 0) {
      sheetSales.getRange(updatedRowIndex, 1, 1, rowValues.length).setValues([rowValues]);
      return ContentService.createTextOutput(JSON.stringify({
        status: "success",
        action: "updated",
        message: "Data omset (" + entryDate + " - " + shift + ") berhasil diperbarui di Google Sheets tanpa duplikat!",
        row: updatedRowIndex
      })).setMimeType(ContentService.MimeType.JSON);
    } else {
      sheetSales.appendRow(rowValues);
      return ContentService.createTextOutput(JSON.stringify({
        status: "success",
        action: "inserted",
        message: "Data omset baru (" + entryDate + " - " + shift + ") berhasil ditambahkan ke Google Sheets!",
        row: sheetSales.getLastRow()
      })).setMimeType(ContentService.MimeType.JSON);
    }

  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({
      status: "error",
      message: err.toString()
    })).setMimeType(ContentService.MimeType.JSON);
  } finally {
    lock.releaseLock();
  }
}

function getOrCreateSheet(doc, name, headers) {
  var sheet = doc.getSheetByName(name);
  if (!sheet) {
    sheet = doc.insertSheet(name);
    sheet.appendRow(headers);
    sheet.getRange(1, 1, 1, headers.length).setFontWeight("bold").setBackground("#c96a2b").setFontColor("#ffffff");
  }
  return sheet;
}