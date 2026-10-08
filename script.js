// --- EFEK SUARA GAME ---
const soundBenar = new Audio('sound correct.mp3');
const soundSalah = new Audio('sound incorrect.mp3');
const soundSelesai = new Audio('sound selesai.mp3');

// Fungsi pembantu untuk memutar suara
function playSound(audio) {
    audio.currentTime = 0; // Reset durasi dari awal
    audio.play().catch(err => console.log("Audio play blocked by browser policy"));
}

// --- MANAJEMEN STATE & LOCALSTORAGE ---
// Menyimpan data di browser agar tidak hilang saat direfresh
let questions = JSON.parse(localStorage.getItem('quiz_questions')) || [];
let results = JSON.parse(localStorage.getItem('quiz_results')) || [];
let quizTimeSetting = parseInt(localStorage.getItem('quiz_time')) || 5; 

// State saat Kuis Siswa Berlangsung
let currentStudent = "";
let currentQuestionIndex = 0;
let studentAnswers = [];
let timerInterval;
let timeRemaining;

// --- NAVIGASI HALAMAN ---
function showView(viewId) {
    // Sembunyikan semua div dengan class 'view'
    document.querySelectorAll('.view').forEach(el => el.classList.remove('active'));
    // Tampilkan view yang dituju
    document.getElementById(viewId).classList.add('active');
}

// --- LOGIKA HAMBURGER MENU ---
function toggleMenu() {
    const dropdown = document.getElementById("guru-dropdown");
    dropdown.classList.toggle("show");
}

// Menutup dropdown otomatis jika user mengklik area di luar menu
window.onclick = function(event) {
    if (!event.target.matches('.hamburger-icon') && !event.target.closest('.hamburger-icon')) {
        const dropdowns = document.getElementsByClassName("dropdown-content");
        for (let i = 0; i < dropdowns.length; i++) {
            let openDropdown = dropdowns[i];
            if (openDropdown.classList.contains('show')) {
                openDropdown.classList.remove('show');
            }
        }
    }
}

function logout() {
    showView('home-screen');
}

// --- MONITORING GURU SECARA REAL-TIME ---
let unsubscribeResults = null;

// --- FUNGSI PERPINDAHAN TAB DASHBOARD GURU ---
function switchTeacherTab(tabId) {
    // Sembunyikan semua isi tab
    document.querySelectorAll('.tab-content').forEach(tab => tab.classList.remove('active'));
    // Matikan status aktif pada semua tombol tab
    document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));

    // Tampilkan tab yang dipilih
    document.getElementById(tabId).classList.add('active');
    
    // Aktifkan tombol yang sesuai
    if (tabId === 'tab-ringkasan') document.getElementById('btn-tab-ringkasan').classList.add('active');
    if (tabId === 'tab-kelola-soal') document.getElementById('btn-tab-kelola-soal').classList.add('active');
    if (tabId === 'tab-hasil-siswa') document.getElementById('btn-tab-hasil-siswa').classList.add('active');
}

// --- RENDER DASHBOARD GURU ---
async function renderTeacherDashboard() {
    // 1. Ambil Soal dari Firestore
    try {
        const querySnapshot = await window.fsFunctions.getDocs(window.fsFunctions.collection(window.db, "questions"));
        questions = [];
        querySnapshot.forEach((doc) => {
            questions.push({ id: doc.id, ...doc.data() });
        });
        document.getElementById('stat-total-soal').innerText = questions.length;
        renderDaftarSoal();
    } catch (error) {
        console.error("Gagal mengambil soal:", error);
    }

    // 2. Real-Time Listener untuk Hasil Siswa
    if (unsubscribeResults) unsubscribeResults();

    try {
        const resultsCollection = window.fsFunctions.collection(window.db, "results");
        unsubscribeResults = window.fsFunctions.onSnapshot(resultsCollection, (snapshot) => {
            results = [];
            const tbody = document.getElementById('data-hasil');
            tbody.innerHTML = '';

            let totalNilai = 0;
            let nilaiTertinggi = 0;
            let no = 1; // Counter untuk nomor urut tabel

            snapshot.forEach((doc) => {
                const res = doc.data();
                results.push(res);

                totalNilai += res.nilai;
                if (res.nilai > nilaiTertinggi) nilaiTertinggi = res.nilai;

                tbody.innerHTML += `
                    <tr>
                        <td>${no++}</td>
                        <td><strong>${res.nama}</strong></td>
                        <td>${res.benar}</td>
                        <td>${res.salah}</td>
                        <td><strong>${res.nilai}</strong></td>
                        <td><span class="badge-success">Selesai</span></td>
                    </tr>
                `;
            });

            // Hitung Ringkasan Kartu
            const totalSiswa = results.length;
            const rataRata = totalSiswa > 0 ? Math.round(totalNilai / totalSiswa) : 0;

            document.getElementById('stat-total-siswa').innerText = totalSiswa;
            document.getElementById('stat-rata-rata').innerText = rataRata;
            document.getElementById('stat-tertinggi').innerText = totalSiswa > 0 ? nilaiTertinggi : 0;
        });
    } catch (error) {
        console.error("Gagal mengambil data hasil siswa:", error);
    }
}

async function simpanSoal() {
    const id = document.getElementById('soal-id').value;
    
    const soalObj = {
        pertanyaan: document.getElementById('pertanyaan').value,
        pilihan: {
            A: document.getElementById('pilihan-a').value,
            B: document.getElementById('pilihan-b').value,
            C: document.getElementById('pilihan-c').value,
            D: document.getElementById('pilihan-d').value
        },
        jawabanBenar: document.getElementById('jawaban-benar').value
    };

    // Validasi input kosong
    if (!soalObj.pertanyaan || !soalObj.pilihan.A || !soalObj.pilihan.B) {
        alert('Lengkapi soal dan minimal pilihan A & B!');
        return;
    }

    try {
        if (id) {
            // Jika ada 'soal-id', lakukan UPDATE ke Firestore
            const docRef = window.fsFunctions.doc(window.db, "questions", id);
            await window.fsFunctions.updateDoc(docRef, soalObj);
            alert("Soal berhasil diperbarui!");
        } else {
            // Jika 'soal-id' kosong, TAMBAH soal baru ke Firestore
            await window.fsFunctions.addDoc(window.fsFunctions.collection(window.db, "questions"), soalObj);
            alert("Soal baru berhasil disimpan!");
        }

        resetFormSoal();
        renderTeacherDashboard(); // Refresh tampilan daftar soal
    } catch (error) {
        console.error("Gagal menyimpan/mengedit soal:", error);
        alert("Terjadi kesalahan saat menyimpan soal.");
    }
}

function renderDaftarSoal() {
    const container = document.getElementById('daftar-soal');
    container.innerHTML = '';
    questions.forEach((q, index) => {
        container.innerHTML += `
            <div class="card">
                <p><strong>Soal ${index + 1}:</strong> ${q.pertanyaan}</p>
                <p>Jawaban: ${q.jawabanBenar}</p>
                <button onclick="editSoal('${q.id}')" class="btn-outline">Edit</button>
                <button onclick="hapusSoal('${q.id}')" class="btn-danger">Hapus</button>
            </div>
        `;
    });
}

async function hapusSoal(id) {
    if(confirm('Yakin ingin menghapus soal ini?')) {
        try {
            await window.fsFunctions.deleteDoc(window.fsFunctions.doc(window.db, "questions", id));
            renderTeacherDashboard();
        } catch (error) {
            console.error("Gagal menghapus soal:", error);
        }
    }
}

function editSoal(id) {
    // Cari soal berdasarkan ID dokumen Firestore
    const q = questions.find(item => item.id === id);
    
    if (q) {
        // Isikan data soal ke dalam form input
        document.getElementById('soal-id').value = q.id;
        document.getElementById('pertanyaan').value = q.pertanyaan;
        
        // Cek jika struktur pilihan tersimpan sebagai objek pilihan
        if (q.pilihan) {
            document.getElementById('pilihan-a').value = q.pilihan.A || '';
            document.getElementById('pilihan-b').value = q.pilihan.B || '';
            document.getElementById('pilihan-c').value = q.pilihan.C || '';
            document.getElementById('pilihan-d').value = q.pilihan.D || '';
        }
        
        document.getElementById('jawaban-benar').value = q.jawabanBenar || 'A';

        // Scroll otomatis ke form edit di bagian atas
        window.scrollTo({ top: 0, behavior: 'smooth' });
    } else {
        alert("Data soal tidak ditemukan!");
    }
}

function resetFormSoal() {
    document.getElementById('soal-id').value = '';
    document.getElementById('pertanyaan').value = '';
    document.getElementById('pilihan-a').value = '';
    document.getElementById('pilihan-b').value = '';
    document.getElementById('pilihan-c').value = '';
    document.getElementById('pilihan-d').value = '';
}

// --- SISWA MASUK & ALUR SISWA ---
async function mulaiKuis() {
    const nama = document.getElementById('nama-siswa').value.trim();
    if (!nama) {
        alert("Harap masukkan nama kamu!");
        return;
    }

    // Ambil soal terbaru dari Firestore sebelum kuis dimulai
    try {
        const querySnapshot = await window.fsFunctions.getDocs(window.fsFunctions.collection(window.db, "questions"));
        questions = [];
        querySnapshot.forEach((doc) => {
            questions.push({ id: doc.id, ...doc.data() });
        });

        if (questions.length === 0) {
            alert("Guru belum membuat soal kuis di Cloud!");
            return;
        }
    
         // Inisialisasi Kuis
        currentStudent = nama;
        currentQuestionIndex = 0;
        studentAnswers = [];
        timeRemaining = quizTimeSetting * 60; // Konversi menit ke detik

        document.getElementById('quiz-nama-siswa').innerText = currentStudent;
        document.getElementById('quiz-total').innerText = questions.length;

        // 12 & 13. Kerjakan Soal & Jalankan Timer
        mulaiTimer();
        renderKuis();
        showView('quiz-screen');
    } catch (error) {
        console.error("Gagal memuat soal untuk siswa:", error);
        alert("Gagal terhubung ke database kuis.");
    }
}

function mulaiTimer() {
    clearInterval(timerInterval);
    timerInterval = setInterval(() => {
        timeRemaining--;
        
        let menit = Math.floor(timeRemaining / 60);
        let detik = timeRemaining % 60;
        
        // Format agar selalu 2 digit (misal 05:09)
        if(menit < 10) menit = "0" + menit;
        if(detik < 10) detik = "0" + detik;
        
        document.getElementById('quiz-timer').innerText = `${menit}:${detik}`;

        if (timeRemaining <= 0) {
            clearInterval(timerInterval);
            alert("Waktu Habis!");
            selesaiKuis();
        }
    }, 1000);
}

function renderKuis() {
    const q = questions[currentQuestionIndex];
    document.getElementById('quiz-progress').innerText = currentQuestionIndex + 1;
    document.getElementById('quiz-pertanyaan').innerText = q.pertanyaan;
    
    const optionsContainer = document.getElementById('quiz-options');
    optionsContainer.innerHTML = '';
    
    // Disable tombol Lanjut jika belum memilih
    document.getElementById('btn-next').disabled = true;

    // Render pilihan A, B, C, D
    const pilihanLabel = ['A', 'B', 'C', 'D'];
    pilihanLabel.forEach(key => {
        const btn = document.createElement('button');
        btn.innerText = `${key}. ${q.pilihan[key]}`;
        btn.onclick = () => pilihJawaban(key, btn);
        optionsContainer.appendChild(btn);
    });
}

function pilihJawaban(jawaban, btnElement) {
    // Simpan jawaban siswa
    studentAnswers[currentQuestionIndex] = jawaban;
    
    // Ambil soal yang sedang diuji
    const soalSaatIni = questions[currentQuestionIndex];

    // Cek apakah pilihan siswa sama dengan jawaban yang benar
    if (jawaban === soalSaatIni.jawabanBenar) {
        playSound(soundBenar); // Bunyi efek benar
    } else {
        playSound(soundSalah); // Bunyi efek salah
    }

    // Hapus efek warna 'selected' pada pilihan lain
    const buttons = document.getElementById('quiz-options').getElementsByTagName('button');
    for (let btn of buttons) {
        btn.classList.remove('selected');
    }
    
    // Beri efek warna 'selected' pada tombol yang baru diklik
    btnElement.classList.add('selected');
    
    // Aktifkan tombol Lanjut
    document.getElementById('btn-next').disabled = false;
}

function nextSoal() {
    currentQuestionIndex++;
    if (currentQuestionIndex < questions.length) {
        renderKuis();
    } else {
        selesaiKuis();
    }
}

// ---  SIMPAN JAWABAN KE CLOUD & HITUNG NILAI ---
async function selesaiKuis() {
    clearInterval(timerInterval);

    // Play suara kuis selesai
    playSound(soundSelesai);

    let benar = 0;
    questions.forEach((q, index) => {
        if (studentAnswers[index] === q.jawabanBenar) {
            benar++;
        }
    });

    const salah = questions.length - benar;
    const nilai = Math.round((benar / questions.length) * 100);

    const hasilSiswa = {
        nama: currentStudent,
        benar: benar,
        salah: salah,
        nilai: nilai,
        waktuSelesai: new Date().toISOString()
    };

    try {
        // Simpan Hasil ke Collection 'results' di Cloud Firestore
        await window.fsFunctions.addDoc(window.fsFunctions.collection(window.db, "results"), hasilSiswa);

        // Tampilkan layar hasil untuk siswa
        document.getElementById('res-nama').innerText = currentStudent;
        document.getElementById('res-benar').innerText = benar;
        document.getElementById('res-salah').innerText = salah;
        document.getElementById('res-nilai').innerText = nilai;

        document.getElementById('nama-siswa').value = '';
        showView('result-screen');
    } catch (error) {
        console.error("Gagal menyimpan hasil kuis ke Firestore:", error);
        alert("Terjadi kesalahan saat menyimpan nilai kuis.");
    }
}

// --- FUNGSI RESET SELURUH HASIL SISWA ---
async function resetHasilSiswa() {
    const konfirmasi = confirm("Yakin ingin menghapus seluruh data hasil siswa? Data yang dihapus tidak bisa dikembalikan.");
    if (!konfirmasi) return;

    try {
        // Ambil seluruh dokumen dari koleksi 'results'
        const querySnapshot = await window.fsFunctions.getDocs(window.fsFunctions.collection(window.db, "results"));
        
        if (querySnapshot.empty) {
            alert("Tidak ada data hasil siswa yang bisa dihapus.");
            return;
        }

        // Hapus setiap dokumen satu per satu
        const deletePromises = [];
        querySnapshot.forEach((docSnap) => {
            const docRef = window.fsFunctions.doc(window.db, "results", docSnap.id);
            deletePromises.push(window.fsFunctions.deleteDoc(docRef));
        });

        await Promise.all(deletePromises);
        alert("Seluruh data hasil siswa berhasil di-reset!");
    } catch (error) {
        console.error("Gagal menghapus data hasil siswa:", error);
        alert("Terjadi kesalahan saat menghapus data.");
    }
}
