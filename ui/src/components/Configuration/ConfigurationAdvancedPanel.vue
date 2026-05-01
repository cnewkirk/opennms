<template>
  <Accordion
    id="advanced-panel"
    class="expansion-panel advanced-panel"
    :value="props.active ? 'panel' : null"
    @update:value="(v) => props.activeUpdate(!!v)"
  >
    <AccordionPanel value="panel">
      <AccordionHeader>Advanced Options (optional)</AccordionHeader>
      <AccordionContent>
    <div>
      <div
        v-bind:key="index"
        v-for="(item, index) in props.items"
        class="item-wrapper"
      >
        <div class="p-float-label">
          <AutoComplete
            :id="`adv-key-${index}`"
            v-model="item.key"
            :suggestions="results.list[index]"
            optionLabel="name"
            @complete="(e) => search(e.query, props.type, props.subType, index)"
            @update:modelValue="updateKey(item.key, index)"
            forceSelection
          />
          <label :for="`adv-key-${index}`">Key</label>
        </div>
        <div class="p-float-label hint-label">
          <InputText
            :id="`adv-val-${index}`"
            v-model="item.value"
          />
          <label :for="`adv-val-${index}`">Value</label>
          <small v-if="item.hint" class="p-hint">{{ item.hint }}</small>
        </div>
        <Button
          text
          @click="() => deleteAdvancedOption(index)"
          aria-label="Delete"
        >
          <i class="pi pi-trash delete-icon" />
        </Button>
      </div>
      <div class="button-wrapper">
        <Button
          :disabled="buttonAddDisabled"
          @click="addAdvancedOption"
          label="Add"
        />
      </div>
    </div>
      </AccordionContent>
    </AccordionPanel>
  </Accordion>
</template>

<script
  setup
  lang="ts"
>
import { PropType } from 'vue'

import Accordion from 'primevue/accordion'
import AccordionPanel from 'primevue/accordionpanel'
import AccordionHeader from 'primevue/accordionheader'
import AccordionContent from 'primevue/accordioncontent'
import AutoComplete from 'primevue/autocomplete'
import InputText from 'primevue/inputtext'
import Button from 'primevue/button'

import { orderBy } from 'lodash'

import { advancedKeys, dnsKeys, openDaylightKeys, aciKeys, zabbixKeys, prisKeys } from './copy/advancedKeys'
import { RequisitionPluginSubTypes, RequisitionTypes, VMWareFields } from './copy/requisitionTypes'
import { AdvancedKey, AdvancedOption } from './configuration.types'
import { ConfigurationHelper } from './ConfigurationHelper'

/**
 * Props
 */
const props = defineProps({
  items: { type: Array as PropType<Array<AdvancedOption>>, required: true },
  type: { type: String, required: true },
  subType: { type: String, required: true },
  addAdvancedOption: { type: Function as PropType<(payload: MouseEvent) => void>, required: true },
  advancedKeyUpdate: { type: Function, required: true },
  deleteAdvancedOption: { type: Function, required: true },
  active: { type: Boolean, required: true },
  activeUpdate: { type: Function as PropType<(_v: boolean) => void>, required: true },
  helpState: Object
})

/**
 * Local State
 */
const results = reactive({
  list: [[{}]]
})

/**
 * Disabled when last item (key.name and value) is null,
 * hence preventing from adding new item.
 */
const buttonAddDisabled = computed(() => {
  const itemsLength = props.items.length

  if (!itemsLength) return false // enabled

  const { key, value } = props.items[itemsLength - 1] // last item
  return !(key.name && value) // disabled
})

const updateKey: any = (key: { hint: string }, index: any) => {
  ConfigurationHelper.forceSetHint(key, index)
  props.advancedKeyUpdate(key, index)
}

/**
 * Depending on which Type is selected, we have different
 * keys in our Advanced Options select options. This
 * method determines which to load. This should eventually be
 * moved to an API solution so we don't store values locally.
 */
const getKeysBasedOnType = (type: string, subType: string) => {

  let keys = new Array<AdvancedKey>()

  if (type === RequisitionTypes.DNS) {
    keys = dnsKeys
  } else if (type === RequisitionTypes.VMWare) {
    keys = orderBy(advancedKeys, 'name', 'asc')
  } else if (type === RequisitionTypes.RequisitionPlugin) {
    if (subType === RequisitionPluginSubTypes.OpenDaylight) {
      keys = openDaylightKeys
    } else if (subType === RequisitionPluginSubTypes.ACI) {
      keys = aciKeys
    } else if (subType === RequisitionPluginSubTypes.Zabbix) {
      keys = zabbixKeys
    } else if (subType === RequisitionPluginSubTypes.PRIS) {
      keys = prisKeys
    }
  }
  return keys
}

/**
 *
 * @param searchVal The Key Name to search for
 * @param index Since there are multiple search boxes, we need to know which one to generate results for.
 */
const search = (searchVal: string, type: string, subType: string, index: number) => {
  // prevent username/Username/password/Password key, using Advanced Options section, from adding to the URL, since they can be set in their respective input field of the form
  const vmWareFields = Object.entries(VMWareFields).map(e => e[1])
  if(vmWareFields.includes(searchVal)) {
    results.list[index] = []
    return
  }

  const advancedKeys = getKeysBasedOnType(type, subType)

  //Find keys based on search text.
  let newResu = advancedKeys.filter((key) => key.name.includes(searchVal) || key.name === searchVal)

  //If there are no results, add one to the list. This enables custom advanced keys.
  if (newResu.length === 0) {
    newResu.push({ name: searchVal, _text: searchVal, id: props.items?.length || 1 })
  }

  //Make sure you can't select the same key twice.
  newResu = newResu.filter((res) => {
    let includeInResults = true
    props.items.forEach((item) => {
      if (item.key.name === res.name) {
        includeInResults = false
      }
    })
    return includeInResults
  })

  results.list[index] = [...newResu]
}

</script>

<style lang="scss">
@import "@featherds/styles/mixins/typography";
@import "@featherds/styles/themes/variables";

#advanced-panel {
  position: relative;
  a[data-ref-id="feather-form-element-clear"] {
    display: none;
  }
  .feather-expansion-header-button-text {
    @include headline4();
    color: var($primary);
  }
}
</style>
<style
  lang="scss"
  scoped
>
@import "@featherds/styles/themes/variables";

.icon {
  width: 40px;
  height: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
  position: absolute;
  top: 13px;
  right: 60px;
  > button {
    margin: 0;
  }
}
.item-wrapper {
  display: flex;
  > div {
    width: 100%;
  }
  > div:first-child {
    margin-right: 16px;
  }
  > button:last-child {
    margin-left: 8px;
  }
}
.button-icon {
  font-size: 24px;
  padding-top: 2px;
  margin-right: 8px;
}
.button-wrapper {
  display: flex;
  justify-content: flex-end;
}
.delete-icon {
  color: var($error);
}
</style>

