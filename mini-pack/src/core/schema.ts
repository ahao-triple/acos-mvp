import { z } from 'zod';

export const gameConfigSchema = z
  .object({
    title: z.string().trim().min(1, 'title must not be empty'),
    entry: z.string().trim().min(1, 'entry must not be empty'),
    publicDir: z.string().trim().min(1, 'publicDir must not be empty'),
    orientation: z.enum(['portrait', 'landscape']),
    canvas: z.object({
      width: z.number().positive('canvas.width must be greater than 0'),
      height: z.number().positive('canvas.height must be greater than 0'),
    }),
  })
  .strict();

export type GameConfig = z.infer<typeof gameConfigSchema>;

export function defineGameConfig(config: GameConfig): GameConfig {
  return config;
}

export const douyinMaterialsSchema = z
  .object({
    appid: z.string(),
    projectName: z.string().trim().min(1, 'douyin.projectName must not be empty'),
    rewardedAdUnitId: z.string().optional(),
    iconPath: z.string().trim().min(1).default('icon.png'),
  })
  .strict();

export type DouyinMaterials = z.infer<typeof douyinMaterialsSchema>;

export function defineDouyinMaterials(materials: DouyinMaterials): DouyinMaterials {
  return materials;
}

export const kuaishouMaterialsSchema = z
  .object({
    appid: z.string(),
    projectName: z.string().trim().min(1, 'kuaishou.projectName must not be empty'),
    rewardedAdUnitId: z.string().optional(),
    iconPath: z.string().trim().min(1).default('icon.png'),
  })
  .strict();

export type KuaishouMaterials = z.infer<typeof kuaishouMaterialsSchema>;

export function defineKuaishouMaterials(materials: KuaishouMaterials): KuaishouMaterials {
  return materials;
}

const PACKAGE_NAME_PATTERN = /^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*)+$/;

export const vivoMaterialsSchema = z
  .object({
    packageName: z
      .string()
      .trim()
      .regex(PACKAGE_NAME_PATTERN, 'packageName must be a reverse domain (e.g. com.example.app)'),
    iconPath: z.string().trim().min(1).default('icon.png'),
    versionName: z.string().trim().min(1).default('1.0.0'),
    versionCode: z.number().int().positive().default(1),
  })
  .strict();

export type VivoMaterials = z.infer<typeof vivoMaterialsSchema>;

export function defineVivoMaterials(materials: VivoMaterials): VivoMaterials {
  return materials;
}
