<script setup>
import { computed } from 'vue';
import { Coins, CircleMinus, PackageCheck, Undo2, Footprints, Menu, LocateFixed, CloudSun, Trash2, Pencil, Pause, Play, Tag, SwatchBook } from '@lucide/vue';
import {Sun,Cloud,CloudRain,CloudSnow,CloudLightning,CloudFog} from '@lucide/vue';
import { Info, Heart, MessageCircle, Share2, House, ShoppingBag, Compass, Shirt, HeartHandshake, UserRound, Bookmark, ChartNoAxesCombined, Settings2, ArrowRight, ArrowLeft, Plus, Check, Link, ImagePlus, Camera, LockKeyhole, Sparkles, Images, X, ChevronRight, PanelLeftClose, PanelLeftOpen, Ellipsis, Bell, Search } from '@lucide/vue';
const props = defineProps({ name: String, size: { type: [Number, String], default: 20 } });
const icons = { heart: Heart, comment: MessageCircle, share: Share2, bookmark: Bookmark, Home: House, Shop: ShoppingBag, Explore: Compass, Closet: Shirt, Sos: HeartHandshake, Profile: UserRound, Bookmarks: Bookmark, Stats: ChartNoAxesCombined, Settings: Settings2, arrow: ArrowRight, back: ArrowLeft, plus: Plus, check: Check, link: Link, upload: ImagePlus, camera: Camera, lock: LockKeyhole, sparkle: Sparkles, album: Images, close: X, chevron: ChevronRight, collapse: PanelLeftClose, expand: PanelLeftOpen, more: Ellipsis, bell: Bell, search: Search };
const commerceIcons = { pass: CircleMinus, purchased: PackageCheck, restore: Undo2, Wishlist: Bookmark, Activity: Footprints, menu: Menu, locate:LocateFixed, weather:CloudSun, sun:Sun,cloud:Cloud,rain:CloudRain,snow:CloudSnow,storm:CloudLightning,fog:CloudFog,delete:Trash2, edit:Pencil, pause:Pause, play:Play, tag:Tag, palette:SwatchBook };
const icon = computed(() => props.name === 'Credits' ? Coins : props.name === 'info' ? Info : commerceIcons[props.name] || icons[props.name] || Sparkles);
</script>
<template><component :is="icon" :size="size" :stroke-width="1.6" aria-hidden="true" class="app-icon" /></template>
<style scoped>.app-icon{flex-shrink:0;vertical-align:middle}</style>
