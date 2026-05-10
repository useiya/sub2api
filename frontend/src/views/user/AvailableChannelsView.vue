<template>
  <AppLayout>
    <div class="space-y-5">
      <section class="overflow-hidden rounded-3xl border border-primary-200/70 bg-white/80 shadow-card backdrop-blur dark:border-primary-700/40 dark:bg-dark-800/70">
        <div class="relative p-5 md:p-6">
          <div class="absolute inset-0 bg-gradient-to-br from-primary-50 via-white to-cyan-50 dark:from-primary-950/60 dark:via-dark-900/40 dark:to-cyan-950/30" />
          <div class="absolute inset-0 opacity-70 dark:opacity-40">
            <div class="absolute -right-16 -top-16 h-56 w-56 rounded-full bg-primary-200 blur-3xl" />
            <div class="absolute bottom-0 left-1/3 h-32 w-96 -rotate-12 bg-cyan-100 blur-2xl" />
          </div>
          <div class="relative flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
            <div>
              <div class="mb-2 flex flex-wrap items-center gap-2">
                <h1 class="text-2xl font-semibold tracking-tight text-gray-900 dark:text-white">
                  {{ t('availableChannels.modelsTitle') }}
                </h1>
                <span class="rounded-full bg-primary-100 px-3 py-1 text-xs font-semibold text-primary-700 ring-1 ring-primary-200/70 dark:bg-primary-900/50 dark:text-primary-200 dark:ring-primary-700/50">
                  {{ t('availableChannels.modelCount', { count: filteredModelCards.length }) }}
                </span>
              </div>
              <p class="max-w-2xl text-sm text-gray-600 dark:text-gray-300">
                {{ t('availableChannels.modelsDescription') }}
              </p>
            </div>
            <Icon name="cloud" size="xl" class="hidden text-primary-500/70 dark:text-primary-300/70 md:block" />
          </div>
        </div>
      </section>

      <div class="flex flex-col gap-5 xl:flex-row">
        <AvailableChannelsFilterPanel
          v-if="viewMode === 'cards'"
          v-model="filters"
          :options="filterOptions"
          class="xl:sticky xl:top-24 xl:w-72 xl:self-start"
        />

        <section class="min-w-0 flex-1 space-y-4">
          <div class="rounded-2xl border border-gray-100 bg-white/90 p-3 shadow-card backdrop-blur dark:border-dark-700/60 dark:bg-dark-800/70">
            <div class="flex flex-col gap-3 lg:flex-row lg:items-center">
              <div class="relative min-w-0 flex-1">
                <Icon
                  name="search"
                  size="md"
                  class="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500"
                />
                <input
                  v-model="filters.query"
                  type="text"
                  :placeholder="t('availableChannels.searchModelPlaceholder')"
                  class="input pl-10"
                />
              </div>

              <div class="flex flex-wrap items-center justify-end gap-2">
                <div class="inline-flex rounded-xl border border-gray-200 bg-gray-50 p-1 dark:border-dark-700 dark:bg-dark-900">
                  <button
                    type="button"
                    class="rounded-lg px-3 py-1.5 text-sm font-medium transition"
                    :class="viewMode === 'cards' ? activeViewClass : inactiveViewClass"
                    @click="viewMode = 'cards'"
                  >
                    {{ t('availableChannels.cardView') }}
                  </button>
                  <button
                    type="button"
                    class="rounded-lg px-3 py-1.5 text-sm font-medium transition"
                    :class="viewMode === 'table' ? activeViewClass : inactiveViewClass"
                    @click="viewMode = 'table'"
                  >
                    {{ t('availableChannels.tableView') }}
                  </button>
                </div>
                <button
                  @click="loadChannels"
                  :disabled="loading"
                  class="btn btn-secondary btn-icon"
                  :title="t('common.refresh', 'Refresh')"
                >
                  <Icon name="refresh" size="md" :class="loading ? 'animate-spin' : ''" />
                </button>
              </div>
            </div>
          </div>

          <div v-if="viewMode === 'cards'">
            <div v-if="loading" class="rounded-2xl border border-gray-100 bg-white py-16 text-center shadow-sm dark:border-dark-700 dark:bg-dark-800/70">
              <Icon name="refresh" size="lg" class="mx-auto animate-spin text-gray-400" />
            </div>
            <div v-else-if="filteredModelCards.length === 0" class="rounded-2xl border border-gray-100 bg-white py-16 text-center shadow-sm dark:border-dark-700 dark:bg-dark-800/70">
              <Icon name="inbox" size="xl" class="mx-auto mb-3 text-gray-400" />
              <p class="text-sm text-gray-500 dark:text-gray-400">{{ t('availableChannels.noMatchedModels') }}</p>
            </div>
            <div v-else class="grid grid-cols-1 gap-4 lg:grid-cols-2 2xl:grid-cols-3">
              <AvailableChannelModelCard
                v-for="card in filteredModelCards"
                :key="card.id"
                :card="card"
                :user-group-rates="userGroupRates"
                :no-pricing-label="t('availableChannels.noPricing')"
              />
            </div>
          </div>

          <AvailableChannelsTable
            v-else
            :columns="columnLabels"
            :rows="legacyFilteredChannels"
            :loading="loading"
            :user-group-rates="userGroupRates"
            pricing-key-prefix="availableChannels.pricing"
            :no-pricing-label="t('availableChannels.noPricing')"
            :no-models-label="t('availableChannels.noModels')"
            :empty-label="t('availableChannels.empty')"
          />
        </section>
      </div>
    </div>
  </AppLayout>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import AppLayout from '@/components/layout/AppLayout.vue'
import Icon from '@/components/icons/Icon.vue'
import AvailableChannelsTable from '@/components/channels/AvailableChannelsTable.vue'
import AvailableChannelModelCard from '@/components/channels/AvailableChannelModelCard.vue'
import AvailableChannelsFilterPanel from '@/components/channels/AvailableChannelsFilterPanel.vue'
import {
  buildAvailableChannelFilterOptions,
  buildAvailableChannelModelCards,
  filterAvailableChannelModelCards,
  type AvailableChannelModelFilters,
} from '@/components/channels/availableChannelModels'
import userChannelsAPI, { type UserAvailableChannel } from '@/api/channels'
import userGroupsAPI from '@/api/groups'
import { useAppStore } from '@/stores/app'
import { extractApiErrorMessage } from '@/utils/apiError'

const { t } = useI18n()
const appStore = useAppStore()

const channels = ref<UserAvailableChannel[]>([])
const userGroupRates = ref<Record<number, number>>({})
const loading = ref(false)
const viewMode = ref<'cards' | 'table'>('cards')
const filters = ref<AvailableChannelModelFilters>({
  query: '',
  channel: '',
  group: '',
  platform: '',
  billingMode: '',
  tag: '',
})
const activeViewClass = 'bg-white text-primary-600 shadow-sm dark:bg-dark-700 dark:text-primary-300'
const inactiveViewClass = 'text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-100'

const columnLabels = computed(() => ({
  name: t('availableChannels.columns.name'),
  description: t('availableChannels.columns.description'),
  platform: t('availableChannels.columns.platform'),
  groups: t('availableChannels.columns.groups'),
  supportedModels: t('availableChannels.columns.supportedModels'),
}))

/**
 * 搜索过滤：
 * - 命中渠道名/描述 → 整个渠道（所有 platforms）都保留
 * - 否则按 platform/group/model 维度在 sections 里过滤，保留有匹配的 section
 * - 所有 sections 都不匹配时，渠道本身被过滤掉
 */
const modelCards = computed(() => buildAvailableChannelModelCards(channels.value))
const filterOptions = computed(() => buildAvailableChannelFilterOptions(modelCards.value))
const filteredModelCards = computed(() => filterAvailableChannelModelCards(modelCards.value, filters.value))

const legacyFilteredChannels = computed(() => {
  const q = filters.value.query.trim().toLowerCase()
  if (!q) return channels.value
  return channels.value
    .map((ch) => {
      const nameHit = ch.name.toLowerCase().includes(q)
      const descHit = (ch.description || '').toLowerCase().includes(q)
      if (nameHit || descHit) return ch
      const matchingSections = ch.platforms.filter(
        (p) =>
          p.platform.toLowerCase().includes(q) ||
          p.groups.some((g) => g.name.toLowerCase().includes(q)) ||
          p.supported_models.some((m) => m.name.toLowerCase().includes(q)),
      )
      if (matchingSections.length === 0) return null
      return { ...ch, platforms: matchingSections }
    })
    .filter((ch): ch is UserAvailableChannel => ch !== null)
})

async function loadChannels() {
  loading.value = true
  try {
    // 渠道列表和用户专属倍率并发拉取。专属倍率失败不阻塞渠道展示——
    // 失败时只是无法渲染专属倍率角标，降级为仅显示默认倍率。
    const [list, rates] = await Promise.all([
      userChannelsAPI.getAvailable(),
      userGroupsAPI.getUserGroupRates().catch((err: unknown) => {
        console.error('Failed to load user group rates:', err)
        return {} as Record<number, number>
      }),
    ])
    channels.value = list
    userGroupRates.value = rates
  } catch (err: unknown) {
    appStore.showError(extractApiErrorMessage(err, t('common.error')))
  } finally {
    loading.value = false
  }
}

onMounted(loadChannels)
</script>
