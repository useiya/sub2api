import { describe, expect, it } from 'vitest'
import {
  buildAvailableChannelFilterOptions,
  buildAvailableChannelModelCards,
  filterAvailableChannelModelCards,
  type AvailableChannelModelFilters,
} from '../availableChannelModels'
import { BILLING_MODE_PER_REQUEST, BILLING_MODE_TOKEN } from '@/constants/channel'
import type { UserAvailableChannel } from '@/api/channels'

const channels: UserAvailableChannel[] = [
  {
    name: 'OpenAI',
    description: 'Codex models',
    platforms: [
      {
        platform: 'openai',
        groups: [
          {
            id: 1,
            name: 'default',
            platform: 'openai',
            subscription_type: 'standard',
            rate_multiplier: 1,
            is_exclusive: false,
          },
        ],
        supported_models: [
          {
            name: 'gpt-5-codex',
            platform: 'openai',
            pricing: {
              billing_mode: BILLING_MODE_TOKEN,
              input_price: 0.00000125,
              output_price: 0.00001,
              cache_write_price: null,
              cache_read_price: 0.00000013,
              image_output_price: null,
              per_request_price: null,
              intervals: [],
            },
          },
        ],
      },
    ],
  },
  {
    name: 'Unknown',
    description: '',
    platforms: [
      {
        platform: 'anthropic',
        groups: [
          {
            id: 2,
            name: 'vip',
            platform: 'anthropic',
            subscription_type: 'subscription',
            rate_multiplier: 0.8,
            is_exclusive: true,
          },
        ],
        supported_models: [
          {
            name: 'claude-opus-4',
            platform: 'anthropic',
            pricing: {
              billing_mode: BILLING_MODE_PER_REQUEST,
              input_price: null,
              output_price: null,
              cache_write_price: null,
              cache_read_price: null,
              image_output_price: null,
              per_request_price: 0.02,
              intervals: [],
            },
          },
        ],
      },
    ],
  },
]

const emptyFilters: AvailableChannelModelFilters = {
  query: '',
  channel: '',
  group: '',
  platform: '',
  billingMode: '',
  tag: '',
}

describe('availableChannelModels', () => {
  it('flattens channels into one card per supported model', () => {
    const cards = buildAvailableChannelModelCards(channels)

    expect(cards).toHaveLength(2)
    expect(cards[0]).toMatchObject({
      id: 'OpenAI::openai::gpt-5-codex',
      channelName: 'OpenAI',
      platform: 'openai',
      modelName: 'gpt-5-codex',
    })
    expect(cards[0].groups.map((group) => group.name)).toEqual(['default'])
  })

  it('builds deduplicated filter options from cards', () => {
    const options = buildAvailableChannelFilterOptions(buildAvailableChannelModelCards(channels))

    expect(options.channels).toEqual(['OpenAI', 'Unknown'])
    expect(options.groups).toEqual(['default', 'vip'])
    expect(options.platforms).toEqual(['anthropic', 'openai'])
    expect(options.billingModes).toEqual([BILLING_MODE_PER_REQUEST, BILLING_MODE_TOKEN])
    expect(options.tags).toContain('reasoning')
  })

  it('filters by query and structured filter fields', () => {
    const cards = buildAvailableChannelModelCards(channels)

    expect(filterAvailableChannelModelCards(cards, { ...emptyFilters, query: 'codex' })).toHaveLength(1)
    expect(filterAvailableChannelModelCards(cards, { ...emptyFilters, group: 'vip' })[0].modelName).toBe('claude-opus-4')
    expect(filterAvailableChannelModelCards(cards, { ...emptyFilters, platform: 'openai' })[0].modelName).toBe('gpt-5-codex')
    expect(filterAvailableChannelModelCards(cards, { ...emptyFilters, billingMode: BILLING_MODE_PER_REQUEST })[0].modelName).toBe('claude-opus-4')
    expect(filterAvailableChannelModelCards(cards, { ...emptyFilters, tag: 'reasoning' })).toHaveLength(2)
  })
})
