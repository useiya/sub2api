<template>
  <aside class="rounded-2xl border border-gray-100 bg-white/85 p-4 shadow-card backdrop-blur dark:border-dark-700/60 dark:bg-dark-800/70">
    <div class="mb-4 flex items-center justify-between">
      <h2 class="text-base font-semibold text-gray-900 dark:text-white">
        {{ t('availableChannels.filters.title') }}
      </h2>
      <button type="button" class="btn btn-secondary btn-sm" @click="resetFilters">
        {{ t('availableChannels.filters.reset') }}
      </button>
    </div>

    <FilterSection :title="t('availableChannels.filters.channel')">
      <FilterButton
        :active="!modelValue.channel"
        :label="t('availableChannels.filters.allChannels')"
        @click="setFilter('channel', '')"
      />
      <FilterButton
        v-for="channel in options.channels"
        :key="channel"
        :active="modelValue.channel === channel"
        :label="channel"
        @click="setFilter('channel', channel)"
      />
    </FilterSection>

    <FilterSection :title="t('availableChannels.filters.group')">
      <FilterButton
        :active="!modelValue.group"
        :label="t('availableChannels.filters.allGroups')"
        @click="setFilter('group', '')"
      />
      <FilterButton
        v-for="group in options.groups"
        :key="group"
        :active="modelValue.group === group"
        :label="group"
        @click="setFilter('group', group)"
      />
    </FilterSection>

    <FilterSection :title="t('availableChannels.filters.billingMode')">
      <FilterButton
        :active="!modelValue.billingMode"
        :label="t('availableChannels.filters.allBillingModes')"
        @click="setFilter('billingMode', '')"
      />
      <FilterButton
        v-for="mode in options.billingModes"
        :key="mode"
        :active="modelValue.billingMode === mode"
        :label="billingModeLabel(mode)"
        @click="setFilter('billingMode', mode)"
      />
    </FilterSection>

    <FilterSection :title="t('availableChannels.filters.platform')">
      <FilterButton
        :active="!modelValue.platform"
        :label="t('availableChannels.filters.allPlatforms')"
        @click="setFilter('platform', '')"
      />
      <FilterButton
        v-for="platform in options.platforms"
        :key="platform"
        :active="modelValue.platform === platform"
        :label="platformLabel(platform)"
        @click="setFilter('platform', platform)"
      />
    </FilterSection>

    <FilterSection :title="t('availableChannels.filters.tag')">
      <FilterButton
        :active="!modelValue.tag"
        :label="t('availableChannels.filters.allTags')"
        @click="setFilter('tag', '')"
      />
      <FilterButton
        v-for="tag in options.tags"
        :key="tag"
        :active="modelValue.tag === tag"
        :label="tagLabel(tag)"
        @click="setFilter('tag', tag)"
      />
    </FilterSection>
  </aside>
</template>

<script setup lang="ts">
import { defineComponent, h } from 'vue'
import { useI18n } from 'vue-i18n'
import { BILLING_MODE_IMAGE, BILLING_MODE_PER_REQUEST, BILLING_MODE_TOKEN } from '@/constants/channel'
import { platformLabel } from '@/utils/platformColors'
import type { AvailableChannelFilterOptions, AvailableChannelModelFilters } from './availableChannelModels'

const props = defineProps<{
  modelValue: AvailableChannelModelFilters
  options: AvailableChannelFilterOptions
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', value: AvailableChannelModelFilters): void
}>()

const { t } = useI18n()

function setFilter(key: keyof AvailableChannelModelFilters, value: string) {
  emit('update:modelValue', { ...props.modelValue, [key]: value })
}

function resetFilters() {
  emit('update:modelValue', {
    query: '',
    channel: '',
    group: '',
    platform: '',
    billingMode: '',
    tag: '',
  })
}

function billingModeLabel(mode: string): string {
  if (mode === BILLING_MODE_TOKEN) return t('availableChannels.pricing.billingModeToken')
  if (mode === BILLING_MODE_PER_REQUEST) return t('availableChannels.pricing.billingModePerRequest')
  if (mode === BILLING_MODE_IMAGE) return t('availableChannels.pricing.billingModeImage')
  return mode
}

function tagLabel(tag: string): string {
  return t(`availableChannels.tags.${tag}`, tag)
}

const FilterSection = defineComponent({
  props: { title: { type: String, required: true } },
  setup(sectionProps, { slots }) {
    return () => h('section', { class: 'mb-6 last:mb-0' }, [
      h('div', { class: 'mb-3 flex items-center gap-3' }, [
        h('div', { class: 'h-px flex-1 bg-gray-100 dark:bg-dark-700' }),
        h('h3', { class: 'text-sm font-semibold text-gray-800 dark:text-gray-100' }, sectionProps.title),
        h('div', { class: 'h-px flex-1 bg-gray-100 dark:bg-dark-700' }),
      ]),
      h('div', { class: 'grid grid-cols-2 gap-2' }, slots.default?.()),
    ])
  },
})

const FilterButton = defineComponent({
  props: {
    active: { type: Boolean, required: true },
    label: { type: String, required: true },
  },
  emits: ['click'],
  setup(buttonProps, { emit: buttonEmit }) {
    return () => h('button', {
      type: 'button',
      class: [
        'min-w-0 rounded-xl border px-3 py-2 text-sm font-medium transition-all',
        buttonProps.active
          ? 'border-transparent bg-gray-100 text-primary-600 shadow-sm dark:bg-dark-700 dark:text-primary-300'
          : 'border-gray-200 bg-white text-gray-700 hover:border-gray-300 hover:bg-gray-50 dark:border-dark-700 dark:bg-dark-800 dark:text-gray-300 dark:hover:bg-dark-700',
      ],
      onClick: () => buttonEmit('click'),
    }, h('span', { class: 'block truncate' }, buttonProps.label))
  },
})
</script>
