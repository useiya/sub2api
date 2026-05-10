import {
  BILLING_MODE_IMAGE,
  BILLING_MODE_PER_REQUEST,
  BILLING_MODE_TOKEN,
  type BillingMode,
} from '@/constants/channel'
import type { UserAvailableChannel, UserAvailableGroup, UserSupportedModel } from '@/api/channels'

const TAG_REASONING = 'reasoning'
const TAG_IMAGE = 'image'
const TAG_TIERED = 'tiered'
const TAG_TOKEN = 'token'
const TAG_PER_REQUEST = 'per-request'

export interface AvailableChannelModelCard {
  id: string
  channelName: string
  channelDescription: string
  platform: string
  modelName: string
  model: UserSupportedModel
  groups: UserAvailableGroup[]
  tags: string[]
}

export interface AvailableChannelModelFilters {
  query: string
  channel: string
  group: string
  platform: string
  billingMode: string
  tag: string
}

export interface AvailableChannelFilterOptions {
  channels: string[]
  groups: string[]
  platforms: string[]
  billingModes: BillingMode[]
  tags: string[]
}

export function buildAvailableChannelModelCards(
  channels: UserAvailableChannel[],
): AvailableChannelModelCard[] {
  return channels.flatMap((channel) =>
    channel.platforms.flatMap((section) =>
      section.supported_models.map((model) => ({
        id: `${channel.name}::${section.platform}::${model.name}`,
        channelName: channel.name,
        channelDescription: channel.description,
        platform: section.platform,
        modelName: model.name,
        model,
        groups: section.groups,
        tags: inferModelTags(model),
      })),
    ),
  )
}

export function buildAvailableChannelFilterOptions(
  cards: AvailableChannelModelCard[],
): AvailableChannelFilterOptions {
  return {
    channels: uniqueSorted(cards.map((card) => card.channelName)),
    groups: uniqueSorted(cards.flatMap((card) => card.groups.map((group) => group.name))),
    platforms: uniqueSorted(cards.map((card) => card.platform)),
    billingModes: uniqueSorted(cards.map((card) => card.model.pricing?.billing_mode).filter(isBillingMode)),
    tags: uniqueSorted(cards.flatMap((card) => card.tags)),
  }
}

export function filterAvailableChannelModelCards(
  cards: AvailableChannelModelCard[],
  filters: AvailableChannelModelFilters,
): AvailableChannelModelCard[] {
  const query = filters.query.trim().toLowerCase()
  return cards.filter((card) => {
    if (query && !matchesQuery(card, query)) return false
    if (filters.channel && card.channelName !== filters.channel) return false
    if (filters.platform && card.platform !== filters.platform) return false
    if (filters.group && !card.groups.some((group) => group.name === filters.group)) return false
    if (filters.billingMode && card.model.pricing?.billing_mode !== filters.billingMode) return false
    if (filters.tag && !card.tags.includes(filters.tag)) return false
    return true
  })
}

function inferModelTags(model: UserSupportedModel): string[] {
  const tags = new Set<string>()
  const pricing = model.pricing
  const name = model.name.toLowerCase()
  const isImageModel = pricing?.billing_mode === BILLING_MODE_IMAGE || name.includes('image')
  if (!isImageModel && (name.includes('gpt') || name.includes('claude') || name.includes('codex'))) {
    tags.add(TAG_REASONING)
  }
  if (isImageModel) {
    tags.add(TAG_IMAGE)
  }
  if (pricing?.billing_mode === BILLING_MODE_TOKEN) tags.add(TAG_TOKEN)
  if (pricing?.billing_mode === BILLING_MODE_PER_REQUEST) tags.add(TAG_PER_REQUEST)
  if (pricing?.intervals && pricing.intervals.length > 0) tags.add(TAG_TIERED)
  return Array.from(tags).sort()
}

function matchesQuery(card: AvailableChannelModelCard, query: string): boolean {
  const fields = [
    card.modelName,
    card.channelName,
    card.channelDescription,
    card.platform,
    ...card.groups.map((group) => group.name),
    ...card.tags,
  ]
  return fields.some((field) => field.toLowerCase().includes(query))
}

function uniqueSorted<T extends string>(values: T[]): T[] {
  return Array.from(new Set(values.filter(Boolean))).sort((a, b) => a.localeCompare(b))
}

function isBillingMode(value: string | undefined): value is BillingMode {
  return value === BILLING_MODE_TOKEN || value === BILLING_MODE_PER_REQUEST || value === BILLING_MODE_IMAGE
}
