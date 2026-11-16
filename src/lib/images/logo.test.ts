import { describe, expect, it } from 'vitest'
import { fitSize } from './logo'

describe('logo sizing', () => {
  it('fits inside 128 x 128 keeping the aspect ratio, never upscaling', () => {
    expect(fitSize(1024, 512)).toEqual({ w: 128, h: 64 })
    expect(fitSize(300, 900)).toEqual({ w: 43, h: 128 })
    expect(fitSize(64, 32)).toEqual({ w: 64, h: 32 })
    expect(fitSize(0, 0)).toEqual({ w: 128, h: 128 })
  })
})
