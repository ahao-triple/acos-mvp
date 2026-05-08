import { z } from 'zod';

export const gameConfigSchema = z
  .object({
    title: z.string().trim().min(1, 'title must not be empty'),
    platform: z.literal('douyin'),
    entry: z.string().trim().min(1, 'entry must not be empty'),
    publicDir: z.string().trim().min(1, 'publicDir must not be empty'),
    outDir: z.string().trim().min(1, 'outDir must not be empty'),
    orientation: z.enum(['portrait', 'landscape']),
    canvas: z.object({
      width: z.number().positive('canvas.width must be greater than 0'),
      height: z.number().positive('canvas.height must be greater than 0'),
    }),
    douyin: z.object({
      appid: z.string(),
      projectName: z.string().trim().min(1, 'douyin.projectName must not be empty'),
      rewardedAdUnitId: z.string().optional(),
    }),
  })
  .strict();

export type GameConfig = z.infer<typeof gameConfigSchema>;

export function defineGameConfig(config: GameConfig): GameConfig {
  return config;
}
