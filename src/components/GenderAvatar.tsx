"use client"

const FEMALE_NAME_TOKENS = [
  "nadia",
  "nadira",
  "annisa",
  "alea",
  "dina",
  "rina",
  "ani",
  "citra",
  "sari",
  "dewi",
  "maya",
  "putri",
  "lestari",
  "wulandari",
  "kusuma",
  "kirana",
  "fadhilla",
  "prameswari",
  "siti",
  "ayu",
  "fitri",
  "indah",
  "ratna",
  "kartika",
  "nina",
  "mega",
  "tiara",
  "amelia",
  "intan",
  "nur",
  "wulan",
  "dian",
  "reni",
]

export function isFemaleGender(
  gender?: string | null,
  name?: string | null,
): boolean {
  const g = (gender || "").trim().toLowerCase()
  if (
    g === "perempuan" ||
    g === "p" ||
    g === "wanita" ||
    g === "female" ||
    g === "f" ||
    g === "cewe" ||
    g === "cewek"
  ) {
    return true
  }
  if (
    g === "laki-laki" ||
    g === "laki" ||
    g === "l" ||
    g === "pria" ||
    g === "male" ||
    g === "m" ||
    g === "cowo" ||
    g === "cowok"
  ) {
    return false
  }

  const normalizedName = (name || "").toLowerCase().replace(/[.,]/g, " ")
  const words = normalizedName.split(/\s+/).filter(Boolean)
  return words.some((word) => FEMALE_NAME_TOKENS.includes(word))
}

type GenderAvatarProps = {
  gender?: string | null
  name?: string | null
  size?: "sm" | "large"
  className?: string
  alt?: string
}

export default function GenderAvatar({
  gender,
  name,
  size = "sm",
  className = "",
  alt,
}: GenderAvatarProps) {
  const female = isFemaleGender(gender, name)
  const src = female ? "/images/avatar-female.jpg" : "/images/avatar-male.jpg"
  const classes = [
    "avatar",
    size === "large" ? "large" : "",
    "avatar-illustrated",
    className,
  ]
    .filter(Boolean)
    .join(" ")

  return (
    <span className={classes} title={name || undefined}>
      <img
        src={src}
        alt={alt || `Foto profil ${name || (female ? "Perempuan" : "Laki-laki")}`}
        className="avatar-img"
      />
    </span>
  )
}

