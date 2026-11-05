import {
  pgTable,
  text,
  timestamp,
  foreignKey,
  pgPolicy,
  check,
  uuid,
  boolean,
  index,
  unique,
  jsonb,
  date,
  integer,
  uniqueIndex,
  smallint,
  time,
  numeric,
  primaryKey,
  pgView,
  pgSequence,
  pgEnum,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import {
  pgSchema as pgSchemaAuth,
  uuid as uuidAuth,
} from "drizzle-orm/pg-core";
const users = pgSchemaAuth("auth").table("users", {
  id: uuidAuth("id").primaryKey(),
});

export const statusAntrean = pgEnum("status_antrean", [
  "menunggu",
  "dipanggil",
  "diperiksa",
  "selesai",
  "dilewati",
  "batal",
]);
export const statusKunjungan = pgEnum("status_kunjungan", [
  "terdaftar",
  "hadir",
  "selesai",
  "batal",
]);
export const sumberDaftar = pgEnum("sumber_daftar", ["online", "walk_in"]);
export const userRole = pgEnum("user_role", [
  "pasien",
  "petugas",
  "dokter",
  "admin",
]);

export const seqNoRekamMedis = pgSequence("seq_no_rekam_medis", {
  startWith: "1",
  increment: "1",
  minValue: "1",
  maxValue: "9223372036854775807",
  cache: "1",
  cycle: false,
});
export const seqNoReferensi = pgSequence("seq_no_referensi", {
  startWith: "1",
  increment: "1",
  minValue: "1",
  maxValue: "9223372036854775807",
  cache: "1",
  cycle: false,
});

export const migrations = pgTable("_migrations", {
  name: text().primaryKey().notNull(),
  appliedAt: timestamp("applied_at", { withTimezone: true, mode: "string" })
    .defaultNow()
    .notNull(),
});

export const profiles = pgTable(
  "profiles",
  {
    id: uuid().primaryKey().notNull(),
    nama: text().notNull(),
    telepon: text(),
    role: userRole().default("pasien").notNull(),
    statusAktif: boolean("status_aktif").default(true).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    foreignKey({
      columns: [table.id],
      foreignColumns: [users.id],
      name: "profiles_id_fkey",
    }).onDelete("cascade"),
    pgPolicy("profiles_select", {
      as: "permissive",
      for: "select",
      to: ["authenticated"],
      using: sql`((id = auth.uid()) OR (my_role() = 'admin'::user_role))`,
    }),
    pgPolicy("profiles_update_admin", {
      as: "permissive",
      for: "update",
      to: ["authenticated"],
    }),
    check(
      "profiles_nama_check",
      sql`(length(btrim(nama)) >= 1) AND (length(btrim(nama)) <= 150)`,
    ),
    check("profiles_telepon_check", sql`telepon ~ '^\+?[0-9]{8,15}$'::text`),
  ],
);

export const tindakan = pgTable(
  "tindakan",
  {
    id: uuid().defaultRandom().primaryKey().notNull(),
    pemeriksaanId: uuid("pemeriksaan_id").notNull(),
    namaTindakan: text("nama_tindakan").notNull(),
    keterangan: text(),
    saran: text(),
  },
  (table) => [
    index("idx_tindakan_pemeriksaan").using(
      "btree",
      table.pemeriksaanId.asc().nullsLast().op("uuid_ops"),
    ),
    foreignKey({
      columns: [table.pemeriksaanId],
      foreignColumns: [pemeriksaan.id],
      name: "tindakan_pemeriksaan_id_fkey",
    }).onDelete("cascade"),
    pgPolicy("tindakan_dokter", {
      as: "permissive",
      for: "all",
      to: ["authenticated"],
      using: sql`((my_role() = 'dokter'::user_role) AND (EXISTS ( SELECT 1
   FROM pemeriksaan p
  WHERE ((p.id = tindakan.pemeriksaan_id) AND (p.dokter_id = my_dokter_id())))))`,
      withCheck: sql`((my_role() = 'dokter'::user_role) AND (EXISTS ( SELECT 1
   FROM pemeriksaan p
  WHERE ((p.id = tindakan.pemeriksaan_id) AND (p.dokter_id = my_dokter_id())))))`,
    }),
    pgPolicy("tindakan_pasien", {
      as: "permissive",
      for: "select",
      to: ["authenticated"],
    }),
    check(
      "tindakan_nama_tindakan_check",
      sql`length(btrim(nama_tindakan)) > 0`,
    ),
  ],
);

export const pemeriksaan = pgTable(
  "pemeriksaan",
  {
    id: uuid().defaultRandom().primaryKey().notNull(),
    kunjunganId: uuid("kunjungan_id").notNull(),
    dokterId: uuid("dokter_id").notNull(),
    anamnesis: text().notNull(),
    tandaVital: jsonb("tanda_vital").default({}).notNull(),
    diagnosis: text().notNull(),
    catatan: text(),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    foreignKey({
      columns: [table.kunjunganId, table.dokterId],
      foreignColumns: [kunjungan.id, kunjungan.dokterId],
      name: "fk_pemeriksaan_kunjungan",
    }),
    unique("pemeriksaan_kunjungan_id_key").on(table.kunjunganId),
    pgPolicy("pemeriksaan_dokter", {
      as: "permissive",
      for: "select",
      to: ["authenticated"],
      using: sql`((my_role() = 'dokter'::user_role) AND (dokter_id = my_dokter_id()))`,
    }),
    pgPolicy("pemeriksaan_ins", {
      as: "permissive",
      for: "insert",
      to: ["authenticated"],
    }),
    pgPolicy("pemeriksaan_pasien", {
      as: "permissive",
      for: "select",
      to: ["authenticated"],
    }),
    pgPolicy("pemeriksaan_upd", {
      as: "permissive",
      for: "update",
      to: ["authenticated"],
    }),
    check("pemeriksaan_anamnesis_check", sql`length(btrim(anamnesis)) > 0`),
    check("pemeriksaan_diagnosis_check", sql`length(btrim(diagnosis)) > 0`),
    check(
      "pemeriksaan_tanda_vital_check",
      sql`CHECK (fn_valid_tanda_vital(tanda_vital`,
    ),
  ],
);

export const antrean = pgTable(
  "antrean",
  {
    id: uuid().defaultRandom().primaryKey().notNull(),
    kunjunganId: uuid("kunjungan_id").notNull(),
    dokterId: uuid("dokter_id").notNull(),
    tanggal: date().notNull(),
    nomorAntrean: integer("nomor_antrean").notNull(),
    status: statusAntrean().default("menunggu").notNull(),
    alasan: text(),
    waktuDipanggil: timestamp("waktu_dipanggil", {
      withTimezone: true,
      mode: "string",
    }),
  },
  (table) => [
    index("idx_antrean_harian").using(
      "btree",
      table.dokterId.asc().nullsLast().op("date_ops"),
      table.tanggal.asc().nullsLast().op("date_ops"),
      table.status.asc().nullsLast().op("enum_ops"),
    ),
    foreignKey({
      columns: [table.kunjunganId, table.dokterId, table.tanggal],
      foreignColumns: [kunjungan.id, kunjungan.dokterId, kunjungan.tanggal],
      name: "fk_antrean_kunjungan",
    }),
    unique("antrean_kunjungan_id_key").on(table.kunjunganId),
    unique("uq_antrean_nomor").on(
      table.dokterId,
      table.tanggal,
      table.nomorAntrean,
    ),
    pgPolicy("antrean_dokter", {
      as: "permissive",
      for: "select",
      to: ["authenticated"],
      using: sql`((my_role() = 'dokter'::user_role) AND (dokter_id = my_dokter_id()))`,
    }),
    pgPolicy("antrean_pasien", {
      as: "permissive",
      for: "select",
      to: ["authenticated"],
    }),
    pgPolicy("antrean_staff", {
      as: "permissive",
      for: "select",
      to: ["authenticated"],
    }),
    check("antrean_nomor_antrean_check", sql`nomor_antrean > 0`),
    check(
      "ck_antrean_alasan",
      sql`(status <> ALL (ARRAY['dilewati'::status_antrean, 'batal'::status_antrean])) OR (length(btrim(COALESCE(alasan, ''::text))) > 0)`,
    ),
  ],
);

export const kunjungan = pgTable(
  "kunjungan",
  {
    id: uuid().defaultRandom().primaryKey().notNull(),
    noReferensi: text("no_referensi")
      .default(
        sql`(\'KJ-\'::text || lpad((nextval(\'seq_no_referensi\'::regclass))::text, 8, \'0\'::text))`,
      )
      .notNull(),
    pasienId: uuid("pasien_id").notNull(),
    dokterId: uuid("dokter_id").notNull(),
    layananId: uuid("layanan_id").notNull(),
    jadwalId: uuid("jadwal_id").notNull(),
    dibuatOleh: uuid("dibuat_oleh").notNull(),
    tanggal: date().notNull(),
    keluhan: text().notNull(),
    sumber: sumberDaftar().notNull(),
    status: statusKunjungan().default("terdaftar").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("idx_kunjungan_dokter").using(
      "btree",
      table.dokterId.asc().nullsLast().op("uuid_ops"),
      table.tanggal.asc().nullsLast().op("uuid_ops"),
    ),
    index("idx_kunjungan_jadwal")
      .using(
        "btree",
        table.jadwalId.asc().nullsLast().op("date_ops"),
        table.tanggal.asc().nullsLast().op("date_ops"),
      )
      .where(sql`(status <> 'batal'::status_kunjungan)`),
    index("idx_kunjungan_pasien").using(
      "btree",
      table.pasienId.asc().nullsLast().op("date_ops"),
      table.tanggal.desc().nullsFirst().op("uuid_ops"),
    ),
    uniqueIndex("uq_kunjungan_aktif")
      .using(
        "btree",
        table.pasienId.asc().nullsLast().op("uuid_ops"),
        table.jadwalId.asc().nullsLast().op("uuid_ops"),
        table.tanggal.asc().nullsLast().op("date_ops"),
      )
      .where(sql`(status <> 'batal'::status_kunjungan)`),
    foreignKey({
      columns: [table.dokterId, table.layananId],
      foreignColumns: [dokterLayanan.dokterId, dokterLayanan.layananId],
      name: "fk_kunjungan_dokter_layanan",
    }),
    foreignKey({
      columns: [table.dokterId, table.jadwalId],
      foreignColumns: [jadwalPraktik.id, jadwalPraktik.dokterId],
      name: "fk_kunjungan_jadwal",
    }),
    foreignKey({
      columns: [table.dibuatOleh],
      foreignColumns: [profiles.id],
      name: "kunjungan_dibuat_oleh_fkey",
    }),
    foreignKey({
      columns: [table.dokterId],
      foreignColumns: [dokter.id],
      name: "kunjungan_dokter_id_fkey",
    }),
    foreignKey({
      columns: [table.layananId],
      foreignColumns: [layanan.id],
      name: "kunjungan_layanan_id_fkey",
    }),
    foreignKey({
      columns: [table.pasienId],
      foreignColumns: [pasien.id],
      name: "kunjungan_pasien_id_fkey",
    }),
    unique("uq_kunjungan_id_dokter").on(table.id, table.dokterId),
    unique("uq_kunjungan_id_dokter_tgl").on(
      table.id,
      table.dokterId,
      table.tanggal,
    ),
    unique("kunjungan_no_referensi_key").on(table.noReferensi),
    pgPolicy("kunjungan_dokter", {
      as: "permissive",
      for: "select",
      to: ["authenticated"],
      using: sql`((my_role() = 'dokter'::user_role) AND (dokter_id = my_dokter_id()))`,
    }),
    pgPolicy("kunjungan_koreksi", {
      as: "permissive",
      for: "update",
      to: ["authenticated"],
    }),
    pgPolicy("kunjungan_pasien", {
      as: "permissive",
      for: "select",
      to: ["authenticated"],
    }),
    pgPolicy("kunjungan_staff", {
      as: "permissive",
      for: "select",
      to: ["authenticated"],
    }),
    check(
      "kunjungan_keluhan_check",
      sql`(length(btrim(keluhan)) >= 1) AND (length(btrim(keluhan)) <= 500)`,
    ),
  ],
);

export const notifikasi = pgTable(
  "notifikasi",
  {
    id: uuid().defaultRandom().primaryKey().notNull(),
    profileId: uuid("profile_id").notNull(),
    pesan: text().notNull(),
    isRead: boolean("is_read").default(false).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("idx_notifikasi_profile").using(
      "btree",
      table.profileId.asc().nullsLast().op("timestamptz_ops"),
      table.isRead.asc().nullsLast().op("uuid_ops"),
      table.createdAt.desc().nullsFirst().op("uuid_ops"),
    ),
    foreignKey({
      columns: [table.profileId],
      foreignColumns: [profiles.id],
      name: "notifikasi_profile_id_fkey",
    }).onDelete("cascade"),
    pgPolicy("notif_select", {
      as: "permissive",
      for: "select",
      to: ["authenticated"],
      using: sql`(profile_id = auth.uid())`,
    }),
    pgPolicy("notif_update", {
      as: "permissive",
      for: "update",
      to: ["authenticated"],
    }),
  ],
);

export const jadwalPraktik = pgTable(
  "jadwal_praktik",
  {
    id: uuid().defaultRandom().primaryKey().notNull(),
    dokterId: uuid("dokter_id").notNull(),
    hari: smallint().notNull(),
    jamMulai: time("jam_mulai").notNull(),
    jamSelesai: time("jam_selesai").notNull(),
    kuota: integer().notNull(),
    aktif: boolean().default(true).notNull(),
  },
  (table) => [
    foreignKey({
      columns: [table.dokterId],
      foreignColumns: [dokter.id],
      name: "jadwal_praktik_dokter_id_fkey",
    }).onDelete("cascade"),
    unique("uq_jadwal_id_dokter").on(table.id, table.dokterId),
    pgPolicy("jadwal_admin", {
      as: "permissive",
      for: "all",
      to: ["authenticated"],
      using: sql`(my_role() = 'admin'::user_role)`,
      withCheck: sql`(my_role() = 'admin'::user_role)`,
    }),
    pgPolicy("jadwal_anon", { as: "permissive", for: "select", to: ["anon"] }),
    pgPolicy("jadwal_read", {
      as: "permissive",
      for: "select",
      to: ["authenticated"],
    }),
    check("ck_jadwal_jam", sql`jam_selesai > jam_mulai`),
    check("jadwal_praktik_hari_check", sql`(hari >= 0) AND (hari <= 6)`),
    check("jadwal_praktik_kuota_check", sql`kuota > 0`),
  ],
);

export const dokter = pgTable(
  "dokter",
  {
    id: uuid().defaultRandom().primaryKey().notNull(),
    profileId: uuid("profile_id"),
    nama: text().notNull(),
    spesialisasi: text().notNull(),
    noSip: text("no_sip").notNull(),
    fotoPath: text("foto_path"),
    deskripsi: text(),
    aktif: boolean().default(true).notNull(),
  },
  (table) => [
    foreignKey({
      columns: [table.profileId],
      foreignColumns: [profiles.id],
      name: "dokter_profile_id_fkey",
    }).onDelete("set null"),
    unique("dokter_profile_id_key").on(table.profileId),
    unique("dokter_no_sip_key").on(table.noSip),
    pgPolicy("dokter_admin", {
      as: "permissive",
      for: "all",
      to: ["authenticated"],
      using: sql`(my_role() = 'admin'::user_role)`,
      withCheck: sql`(my_role() = 'admin'::user_role)`,
    }),
    pgPolicy("dokter_anon", { as: "permissive", for: "select", to: ["anon"] }),
    pgPolicy("dokter_read", {
      as: "permissive",
      for: "select",
      to: ["authenticated"],
    }),
    check("dokter_nama_check", sql`length(btrim(nama)) > 0`),
  ],
);

export const layanan = pgTable(
  "layanan",
  {
    id: uuid().defaultRandom().primaryKey().notNull(),
    namaLayanan: text("nama_layanan").notNull(),
    deskripsi: text(),
    durasiMenit: integer("durasi_menit").notNull(),
    aktif: boolean().default(true).notNull(),
  },
  (table) => [
    unique("layanan_nama_layanan_key").on(table.namaLayanan),
    pgPolicy("layanan_admin", {
      as: "permissive",
      for: "all",
      to: ["authenticated"],
      using: sql`(my_role() = 'admin'::user_role)`,
      withCheck: sql`(my_role() = 'admin'::user_role)`,
    }),
    pgPolicy("layanan_anon", { as: "permissive", for: "select", to: ["anon"] }),
    pgPolicy("layanan_read", {
      as: "permissive",
      for: "select",
      to: ["authenticated"],
    }),
    check(
      "layanan_durasi_menit_check",
      sql`(durasi_menit >= 1) AND (durasi_menit <= 480)`,
    ),
    check("layanan_nama_layanan_check", sql`length(btrim(nama_layanan)) > 0`),
  ],
);

export const pasien = pgTable(
  "pasien",
  {
    id: uuid().defaultRandom().primaryKey().notNull(),
    profileId: uuid("profile_id"),
    noRekamMedis: text("no_rekam_medis")
      .default(
        sql`(\'RM-\'::text || lpad((nextval(\'seq_no_rekam_medis\'::regclass))::text, 6, \'0\'::text))`,
      )
      .notNull(),
    nama: text().notNull(),
    nik: text(),
    tanggalLahir: date("tanggal_lahir").notNull(),
    jenisKelamin: text("jenis_kelamin").notNull(),
    alamat: text(),
    telepon: text(),
    kontakDarurat: text("kontak_darurat"),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("idx_pasien_nama").using("btree", sql`lower(nama)`),
    index("idx_pasien_telepon").using(
      "btree",
      table.telepon.asc().nullsLast().op("text_ops"),
    ),
    uniqueIndex("uq_pasien_nik")
      .using("btree", table.nik.asc().nullsLast().op("text_ops"))
      .where(sql`(nik IS NOT NULL)`),
    foreignKey({
      columns: [table.profileId],
      foreignColumns: [profiles.id],
      name: "pasien_profile_id_fkey",
    }).onDelete("set null"),
    unique("pasien_profile_id_key").on(table.profileId),
    unique("pasien_no_rekam_medis_key").on(table.noRekamMedis),
    pgPolicy("pasien_dokter", {
      as: "permissive",
      for: "select",
      to: ["authenticated"],
      using: sql`((my_role() = 'dokter'::user_role) AND (EXISTS ( SELECT 1
   FROM kunjungan k
  WHERE ((k.pasien_id = pasien.id) AND (k.dokter_id = my_dokter_id())))))`,
    }),
    pgPolicy("pasien_insert", {
      as: "permissive",
      for: "insert",
      to: ["authenticated"],
    }),
    pgPolicy("pasien_self", {
      as: "permissive",
      for: "select",
      to: ["authenticated"],
    }),
    pgPolicy("pasien_staff", {
      as: "permissive",
      for: "select",
      to: ["authenticated"],
    }),
    pgPolicy("pasien_upd_petugas", {
      as: "permissive",
      for: "update",
      to: ["authenticated"],
    }),
    pgPolicy("pasien_upd_self", {
      as: "permissive",
      for: "update",
      to: ["authenticated"],
    }),
    check(
      "pasien_jenis_kelamin_check",
      sql`jenis_kelamin = ANY (ARRAY['L'::text, 'P'::text])`,
    ),
    check(
      "pasien_nama_check",
      sql`(length(btrim(nama)) >= 1) AND (length(btrim(nama)) <= 150)`,
    ),
    check("pasien_nik_check", sql`nik ~ '^[0-9]{16}$'::text`),
    check(
      "pasien_tanggal_lahir_check",
      sql`(tanggal_lahir >= '1900-01-01'::date) AND (tanggal_lahir <= CURRENT_DATE)`,
    ),
    check("pasien_telepon_check", sql`telepon ~ '^\+?[0-9]{8,15}$'::text`),
  ],
);

export const profilKlinik = pgTable(
  "profil_klinik",
  {
    id: uuid().defaultRandom().primaryKey().notNull(),
    nama: text().notNull(),
    deskripsi: text(),
    alamat: text(),
    latitude: numeric({ precision: 9, scale: 6 }),
    longitude: numeric({ precision: 9, scale: 6 }),
    kontak: text(),
    jamOperasional: jsonb("jam_operasional").default({}).notNull(),
  },
  (table) => [
    uniqueIndex("uq_profil_klinik_satu_baris").using("btree", sql`(true)`),
    pgPolicy("klinik_admin", {
      as: "permissive",
      for: "all",
      to: ["authenticated"],
      using: sql`(my_role() = 'admin'::user_role)`,
      withCheck: sql`(my_role() = 'admin'::user_role)`,
    }),
    pgPolicy("klinik_read", {
      as: "permissive",
      for: "select",
      to: ["anon", "authenticated"],
    }),
    check(
      "profil_klinik_latitude_check",
      sql`(latitude >= ('-90'::integer)::numeric) AND (latitude <= (90)::numeric)`,
    ),
    check(
      "profil_klinik_longitude_check",
      sql`(longitude >= ('-180'::integer)::numeric) AND (longitude <= (180)::numeric)`,
    ),
  ],
);

export const dokterLayanan = pgTable(
  "dokter_layanan",
  {
    dokterId: uuid("dokter_id").notNull(),
    layananId: uuid("layanan_id").notNull(),
  },
  (table) => [
    foreignKey({
      columns: [table.dokterId],
      foreignColumns: [dokter.id],
      name: "dokter_layanan_dokter_id_fkey",
    }).onDelete("cascade"),
    foreignKey({
      columns: [table.layananId],
      foreignColumns: [layanan.id],
      name: "dokter_layanan_layanan_id_fkey",
    }).onDelete("cascade"),
    primaryKey({
      columns: [table.dokterId, table.layananId],
      name: "dokter_layanan_pkey",
    }),
    pgPolicy("dl_admin", {
      as: "permissive",
      for: "all",
      to: ["authenticated"],
      using: sql`(my_role() = 'admin'::user_role)`,
      withCheck: sql`(my_role() = 'admin'::user_role)`,
    }),
    pgPolicy("dl_read", {
      as: "permissive",
      for: "select",
      to: ["anon", "authenticated"],
    }),
  ],
);
export const vAntreanDetail = pgView("v_antrean_detail", {
  antreanId: uuid("antrean_id"),
  kunjunganId: uuid("kunjungan_id"),
  dokterId: uuid("dokter_id"),
  tanggal: date(),
  nomorAntrean: integer("nomor_antrean"),
  statusAntrean: statusAntrean("status_antrean"),
  alasan: text(),
  waktuDipanggil: timestamp("waktu_dipanggil", {
    withTimezone: true,
    mode: "string",
  }),
  noReferensi: text("no_referensi"),
  statusKunjungan: statusKunjungan("status_kunjungan"),
  keluhan: text(),
  sumber: sumberDaftar(),
  layananId: uuid("layanan_id"),
  jadwalId: uuid("jadwal_id"),
  pasienId: uuid("pasien_id"),
  namaPasien: text("nama_pasien"),
  noRekamMedis: text("no_rekam_medis"),
  namaDokter: text("nama_dokter"),
  namaLayanan: text("nama_layanan"),
  jamMulai: time("jam_mulai"),
  jamSelesai: time("jam_selesai"),
})
  .with({ securityInvoker: true })
  .as(
    sql`SELECT a.id AS antrean_id, a.kunjungan_id, a.dokter_id, a.tanggal, a.nomor_antrean, a.status AS status_antrean, a.alasan, a.waktu_dipanggil, k.no_referensi, k.status AS status_kunjungan, k.keluhan, k.sumber, k.layanan_id, k.jadwal_id, ps.id AS pasien_id, ps.nama AS nama_pasien, ps.no_rekam_medis, d.nama AS nama_dokter, l.nama_layanan, jp.jam_mulai, jp.jam_selesai FROM antrean a JOIN kunjungan k ON k.id = a.kunjungan_id JOIN pasien ps ON ps.id = k.pasien_id JOIN dokter d ON d.id = k.dokter_id JOIN layanan l ON l.id = k.layanan_id JOIN jadwal_praktik jp ON jp.id = k.jadwal_id`,
  );

export const vRiwayatKunjungan = pgView("v_riwayat_kunjungan", {
  kunjunganId: uuid("kunjungan_id"),
  noReferensi: text("no_referensi"),
  tanggal: date(),
  status: statusKunjungan(),
  sumber: sumberDaftar(),
  keluhan: text(),
  pasienId: uuid("pasien_id"),
  dokterId: uuid("dokter_id"),
  namaDokter: text("nama_dokter"),
  spesialisasi: text(),
  namaLayanan: text("nama_layanan"),
  nomorAntrean: integer("nomor_antrean"),
  statusAntrean: statusAntrean("status_antrean"),
  pemeriksaanId: uuid("pemeriksaan_id"),
  anamnesis: text(),
  tandaVital: jsonb("tanda_vital"),
  diagnosis: text(),
  catatan: text(),
})
  .with({ securityInvoker: true })
  .as(
    sql`SELECT k.id AS kunjungan_id, k.no_referensi, k.tanggal, k.status, k.sumber, k.keluhan, k.pasien_id, d.id AS dokter_id, d.nama AS nama_dokter, d.spesialisasi, l.nama_layanan, a.nomor_antrean, a.status AS status_antrean, pm.id AS pemeriksaan_id, pm.anamnesis, pm.tanda_vital, pm.diagnosis, pm.catatan FROM kunjungan k JOIN dokter d ON d.id = k.dokter_id JOIN layanan l ON l.id = k.layanan_id LEFT JOIN antrean a ON a.kunjungan_id = k.id LEFT JOIN pemeriksaan pm ON pm.kunjungan_id = k.id`,
  );

export const vRekapKunjungan = pgView("v_rekap_kunjungan", {
  tanggal: date(),
  minggu: date(),
  bulan: date(),
  dokterId: uuid("dokter_id"),
  namaDokter: text("nama_dokter"),
  layananId: uuid("layanan_id"),
  namaLayanan: text("nama_layanan"),
  status: statusKunjungan(),
  sumber: sumberDaftar(),
  jumlah: integer(),
})
  .with({ securityInvoker: true })
  .as(
    sql`SELECT k.tanggal, date_trunc('week'::text, k.tanggal::timestamp with time zone)::date AS minggu, date_trunc('month'::text, k.tanggal::timestamp with time zone)::date AS bulan, k.dokter_id, d.nama AS nama_dokter, k.layanan_id, l.nama_layanan, k.status, k.sumber, count(*)::integer AS jumlah FROM kunjungan k JOIN dokter d ON d.id = k.dokter_id JOIN layanan l ON l.id = k.layanan_id GROUP BY k.tanggal, k.dokter_id, d.nama, k.layanan_id, l.nama_layanan, k.status, k.sumber`,
  );
