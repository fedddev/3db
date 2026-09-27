import bodyFont from '@fontsource/figtree/files/figtree-latin-600-normal.woff?url'
import brandFont from '@fontsource/michroma/files/michroma-latin-400-normal.woff?url'
import { Text, useTexture } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import { useRef } from 'react'
import { SRGBColorSpace, type Group, type MeshBasicMaterial } from 'three'
import { useStore } from '../store'
import { BASE, MUTED_TEXT } from './colors'
import { EASE_RATE } from './layout'

// 3db's opening branding: "3DB" in giant Michroma letters in the sky past the
// far end of the floor, then "by", then the fedddev logo (dark-mode artwork). It
// fades out once a world has records and back in when the scene is empty.
// Sized so that from the start point both clear the welcome box and the logo
// stays above the brand's 120 px minimum.
const Z = -80
const LOGO_HEIGHT = 15
const LOGO_BOTTOM = 2
const BY_SIZE = 2.6
const WORD_SIZE = 20
// "3DB" is pinned by its baseline (where the capitals sit), and "by" is
// centered halfway between that baseline and the top of the logo artwork.
const LOGO_TOP = LOGO_BOTTOM + LOGO_HEIGHT
const WORD_BASELINE = LOGO_TOP + 8.8
const BY_CENTER = (LOGO_TOP + WORD_BASELINE) / 2
// Nudged right so "3DB" reads as centered over the logo (about 1.5% of a
// 1440 px-wide screen from the start point).
const WORD_NUDGE_X = 2.6

export function Splash() {
  const empty = useStore((s) => !s.layout?.n)
  const logo = useTexture('/brand/png/logo-dark-1200.png', (t) => void (t.colorSpace = SRGBColorSpace))
  const group = useRef<Group>(null!)
  const word = useRef<{ fillOpacity: number }>(null!)
  const by = useRef<{ fillOpacity: number }>(null!)
  const logoMaterial = useRef<MeshBasicMaterial>(null!)
  const opacity = useRef(1)

  useFrame((_, dt) => {
    const target = empty ? 1 : 0
    opacity.current += (target - opacity.current) * (1 - Math.exp(-Math.min(dt, 0.1) * EASE_RATE))
    if (Math.abs(target - opacity.current) < 0.002) opacity.current = target
    group.current.visible = opacity.current > 0
    word.current.fillOpacity = opacity.current
    by.current.fillOpacity = opacity.current
    logoMaterial.current.opacity = opacity.current
  })

  const { width, height } = logo.image as { width: number; height: number }
  return (
    <group ref={group} position={[0, 0, Z]}>
      <Text
        ref={word}
        font={brandFont}
        fontSize={WORD_SIZE}
        color={BASE}
        anchorX="center"
        anchorY="bottom-baseline"
        position={[WORD_NUDGE_X, WORD_BASELINE, 0]}
      >
        3DB
      </Text>
      <Text ref={by} font={bodyFont} fontSize={BY_SIZE} color={MUTED_TEXT} anchorX="center" anchorY="middle" position={[0, BY_CENTER, 0]}>
        by
      </Text>
      <mesh position={[0, LOGO_BOTTOM + LOGO_HEIGHT / 2, 0]}>
        <planeGeometry args={[(LOGO_HEIGHT * width) / height, LOGO_HEIGHT]} />
        {/* Not tone-mapped, so the artwork keeps its exact brand colors. */}
        <meshBasicMaterial ref={logoMaterial} map={logo} transparent toneMapped={false} fog={false} />
      </mesh>
    </group>
  )
}
