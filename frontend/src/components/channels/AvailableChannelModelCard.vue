<template>
  <article
    class="group relative min-h-[190px] overflow-hidden rounded-2xl border bg-white p-4 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-card-hover dark:bg-dark-800/70"
    :class="platformBorderClass(card.platform)"
  >
    <div class="absolute inset-x-0 top-0 h-1" :class="platformAccentBarClass(card.platform)" />

    <div class="flex items-start gap-3">
      <div
        class="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gray-100 text-lg font-bold text-gray-500 shadow-sm dark:bg-dark-700 dark:text-gray-300"
      >
        {{ modelInitials }}
      </div>

      <div class="min-w-0 flex-1">
        <div class="flex items-start justify-between gap-3">
          <div class="min-w-0">
            <h3 class="truncate text-lg font-semibold text-gray-900 dark:text-white">
              {{ card.modelName }}
            </h3>
            <div class="mt-1 flex flex-wrap items-center gap-1.5">
              <span
                class="inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[11px] font-medium"
                :class="platformBadgeClass(card.platform)"
              >
                <PlatformIcon :platform="card.platform as GroupPlatform" size="xs" />
                {{ platformLabel(card.platform) }}
              </span>
              <span class="text-xs text-gray-400">{{ card.channelName }}</span>
            </div>
          </div>

          <button
            type="button"
            class="rounded-lg border border-gray-200 p-1.5 text-gray-400 transition hover:border-gray-300 hover:text-gray-700 dark:border-dark-700 dark:hover:text-gray-200"
            :title="t('availableChannels.copyModel')"
            @click="copyModelName"
          >
            <Icon name="copy" size="sm" />
          </button>
        </div>

        <div class="mt-3 space-y-1 text-xs text-gray-600 dark:text-gray-300">
          <template v-if="priceRows.length > 0">
            <div v-for="row in priceRows" :key="row.label" class="flex items-center gap-2">
              <span class="w-20 shrink-0 text-gray-500 dark:text-gray-400">{{ row.label }}</span>
              <span class="font-medium text-gray-800 dark:text-gray-100">{{ row.value }}</span>
            </div>
          </template>
          <p v-else class="text-gray-500 dark:text-gray-400">{{ noPricingLabel }}</p>
        </div>
      </div>
    </div>

    <p class="mt-4 line-clamp-2 min-h-[2.5rem] text-sm text-gray-500 dark:text-gray-400">
      {{ descriptionText }}
    </p>

    <div class="mt-4 flex flex-wrap items-center gap-1.5">
      <GroupBadge
        v-for="group in visibleGroups"
        :key="group.id"
        :name="group.name"
        :platform="group.platform as GroupPlatform"
        :subscription-type="(group.subscription_type || 'standard') as SubscriptionType"
        :rate-multiplier="group.rate_multiplier"
        :user-rate-multiplier="userGroupRates[group.id] ?? null"
        always-show-rate
      />
      <span
        v-if="hiddenGroupCount > 0"
        class="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-500 dark:bg-dark-700 dark:text-gray-300"
      >
        +{{ hiddenGroupCount }}
      </span>
    </div>

    <div class="mt-3 flex flex-wrap justify-end gap-1.5">
      <span
        v-for="tag in card.tags"
        :key="tag"
        class="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-600 dark:bg-dark-700 dark:text-gray-300"
      >
        {{ tagLabel(tag) }}
      </span>
    </div>
  </article>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import Icon from '@/components/icons/Icon.vue'
import GroupBadge from '@/components/common/GroupBadge.vue'
import PlatformIcon from '@/components/common/PlatformIcon.vue'
import { useClipboard } from '@/composables/useClipboard'
import { BILLING_MODE_IMAGE, BILLING_MODE_PER_REQUEST, BILLING_MODE_TOKEN } from '@/constants/channel'
import { formatScaled } from '@/utils/pricing'
import {
  platformAccentBarClass,
  platformBadgeClass,
  platformBorderClass,
  platformLabel,
} from '@/utils/platformColors'
import type { GroupPlatform, SubscriptionType } from '@/types'
import type { AvailableChannelModelCard } from './availableChannelModels'

const visibleGroupLimit = 3
const perMillionScale = 1_000_000

const props = defineProps<{
  card: AvailableChannelModelCard
  userGroupRates: Record<number, number>
  noPricingLabel: string
}>()

const { t } = useI18n()
const { copyToClipboard } = useClipboard()

const visibleGroups = computed(() => props.card.groups.slice(0, visibleGroupLimit))
const hiddenGroupCount = computed(() => Math.max(0, props.card.groups.length - visibleGroupLimit))

const modelInitials = computed(() => {
  const parts = props.card.modelName.split(/[-_\s]+/).filter(Boolean)
  const letters = parts.slice(0, 2).map((part) => part[0]?.toUpperCase()).join('')
  return letters || props.card.platform.slice(0, 2).toUpperCase()
})

const descriptionText = computed(() => {
  if (props.card.channelDescription) return props.card.channelDescription
  return t('availableChannels.modelCardDescription', {
    channel: props.card.channelName,
    platform: platformLabel(props.card.platform),
  })
})

const priceRows = computed(() => {
  const pricing = props.card.model.pricing
  if (!pricing) return []
  if (pricing.billing_mode === BILLING_MODE_TOKEN) return tokenPriceRows(pricing)
  if (pricing.billing_mode === BILLING_MODE_PER_REQUEST) {
    return [{ label: t('availableChannels.pricing.perRequestPrice'), value: formatScaled(pricing.per_request_price, 1) }]
  }
  if (pricing.billing_mode === BILLING_MODE_IMAGE) {
    return [{ label: t('availableChannels.pricing.imageOutputPrice'), value: formatScaled(pricing.image_output_price, 1) }]
  }
  return []
})

function tokenPriceRows(pricing: NonNullable<AvailableChannelModelCard['model']['pricing']>) {
  return [
    { label: t('availableChannels.pricing.inputPrice'), value: formatScaled(pricing.input_price, perMillionScale) },
    { label: t('availableChannels.pricing.outputPrice'), value: formatScaled(pricing.output_price, perMillionScale) },
    { label: t('availableChannels.pricing.cacheReadPrice'), value: formatScaled(pricing.cache_read_price, perMillionScale) },
  ]
}

function tagLabel(tag: string): string {
  return t(`availableChannels.tags.${tag}`, tag)
}

function copyModelName() {
  copyToClipboard(props.card.modelName, t('availableChannels.modelCopied'))
}
</script>
