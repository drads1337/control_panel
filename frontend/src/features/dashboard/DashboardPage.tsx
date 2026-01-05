"use client"

import { useEffect, useRef, useCallback, useMemo, useState } from "react"
import { useTheme } from "next-themes"
import mapboxgl from "mapbox-gl"
import "mapbox-gl/dist/mapbox-gl.css"
import { AccessDenied } from "@/shared/ui/components"
import { useAuthContext } from "@/app/providers/auth-provider"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Search, X, Filter } from "lucide-react"
import type { GeoJSONSource } from "mapbox-gl"
import { getMapRequests, type MapRequestPoint, type MapCity } from "@/entities/dashboard/api/dashboard"
import { useQuery } from "@tanstack/react-query"

// --- CSS Styles ---
const MAP_STYLES = `
  /* Сброс стилей Mapbox Popup */
  .mapboxgl-popup { z-index: 50; }
  .mapboxgl-popup-content { background: transparent !important; padding: 0 !important; box-shadow: none !important; }
  .mapboxgl-popup-tip { display: none; }

  /* Общий стиль стекла (и для попапа, и для float card) */
  .glass-panel {
    backdrop-filter: blur(16px);
    -webkit-backdrop-filter: blur(16px);
    border: 1px solid;
    font-family: -apple-system, BlinkMacSystemFont, "Inter", sans-serif;
  }

  /* Темы для панелей */
  .panel-light {
    background: rgba(255, 255, 255, 0.85);
    border-color: rgba(255, 255, 255, 0.6);
    color: #0f172a;
    box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05), 0 2px 4px -1px rgba(0, 0, 0, 0.03);
  }

  .panel-dark {
    background: rgba(15, 23, 42, 0.75);
    border-color: rgba(255, 255, 255, 0.08);
    color: #f8fafc;
    box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.2);
  }
`

// Преобразуем точки в GeoJSON формат
const createGeoJSON = (points: MapRequestPoint[]) => {
  return {
    type: "FeatureCollection" as const,
    features: points.map((point) => ({
      type: "Feature" as const,
      geometry: {
        type: "Point" as const,
        coordinates: [point.lng, point.lat],
      },
      properties: {
        id: point.id,
        city: point.city,
        country: point.country,
        ip_address: point.ip_address,
        hwid: point.hwid,
        action: point.action,
      },
    })),
  }
}

export default function Dashboard01Block() {
  const { user, isAuthenticated, isInitialized } = useAuthContext()
  const { resolvedTheme } = useTheme()
  const mapContainer = useRef<HTMLDivElement>(null)
  const map = useRef<mapboxgl.Map | null>(null)
  const popup = useRef<mapboxgl.Popup | null>(null)
  const eventHandlers = useRef<Array<() => void>>([])

  // Search state
  const [filterValue, setFilterValue] = useState("")
  const [isFilterOpen, setIsFilterOpen] = useState(false)
  const [currentZoom, setCurrentZoom] = useState(3.5)

  // Parse filter value - determine if it's IP or HWID
  const isIPAddress = (value: string): boolean => {
    if (!value) return false
    // Simple IP pattern: contains dots and matches basic IP format
    const ipPattern = /^(\d{1,3}\.){3}\d{1,3}$/
    return ipPattern.test(value.trim())
  }

  const hwidSearch = filterValue && !isIPAddress(filterValue) ? filterValue : ""
  const ipSearch = filterValue && isIPAddress(filterValue) ? filterValue : ""

  // Fetch map data
  const { data: mapData, isLoading } = useQuery({
    queryKey: ['map-requests', hwidSearch, ipSearch],
    queryFn: () => getMapRequests({
      hwid: hwidSearch || undefined,
      ip: ipSearch || undefined,
    }),
    enabled: isAuthenticated && !!user,
    refetchInterval: 30000, // Refetch every 30 seconds
  })

  // Calculate totals for Float Card
  const stats = useMemo(() => {
    if (!mapData) {
      return {
        totalRequests: 0,
        totalConnections: 0,
        totalKeys: 0,
        totalUsers: 0
      }
    }

    return {
      totalRequests: mapData.total_points,
      totalConnections: mapData.total_points, // Using same value for now
      totalKeys: mapData.total_points, // Mock data - replace with real API data
      totalUsers: mapData.total_points // Mock data - replace with real API data
    }
  }, [mapData])

  // Determine what to show based on zoom level
  const shouldShowCities = currentZoom < 8 // Show cities on low zoom
  const shouldShowPoints = currentZoom >= 8 // Show individual points on high zoom

  const setupMapLayers = useCallback((points: MapRequestPoint[]) => {
    if (!map.current || points.length === 0) return

    const isDark = resolvedTheme === "dark"
    const themeClass = isDark ? "panel-dark" : "panel-light"

    // Удаляем старые слои и источники если они есть
    if (map.current.getLayer('clusters')) {
      map.current.removeLayer('clusters')
    }
    if (map.current.getLayer('cluster-count')) {
      map.current.removeLayer('cluster-count')
    }
    if (map.current.getLayer('unclustered-point')) {
      map.current.removeLayer('unclustered-point')
    }

    const source = map.current.getSource('requests') as GeoJSONSource | null
    if (source) {
      source.setData(createGeoJSON(points))
      return
    }

    // Добавляем источник данных с кластеризацией
    map.current.addSource('requests', {
      type: 'geojson',
      data: createGeoJSON(points),
      cluster: true,
      clusterMaxZoom: 8, // Максимальный зум для кластеризации (города)
      clusterRadius: 50, // Радиус кластеризации в пикселях
    })

    // Слой для кластеров (города на низком зуме)
    map.current.addLayer({
      id: 'clusters',
      type: 'circle',
      source: 'requests',
      filter: ['has', 'point_count'],
      paint: {
        'circle-color': [
          'step',
          ['get', 'point_count'],
          'rgba(59, 130, 246, 0.6)',
          10,
          'rgba(59, 130, 246, 0.7)',
          30,
          'rgba(59, 130, 246, 0.8)',
          50,
          'rgba(59, 130, 246, 0.9)',
        ],
        'circle-radius': [
          'step',
          ['get', 'point_count'],
          20,
          10,
          30,
          30,
          40,
          50,
          50,
        ],
        'circle-stroke-width': 2,
        'circle-stroke-color': isDark ? 'rgba(255, 255, 255, 0.2)' : 'rgba(255, 255, 255, 0.8)',
      },
    })

    // Слой для текста с количеством точек в кластере
    map.current.addLayer({
      id: 'cluster-count',
      type: 'symbol',
      source: 'requests',
      filter: ['has', 'point_count'],
      layout: {
        'text-field': '{point_count_abbreviated}',
        'text-font': ['Open Sans Semibold', 'Arial Unicode MS Bold'],
        'text-size': 12,
      },
      paint: {
        'text-color': isDark ? '#f8fafc' : '#0f172a',
      },
    })

    // Слой для отдельных точек (устройства на высоком зуме)
    map.current.addLayer({
      id: 'unclustered-point',
      type: 'circle',
      source: 'requests',
      filter: ['!', ['has', 'point_count']],
      paint: {
        'circle-color': '#3b82f6',
        'circle-radius': 8,
        'circle-stroke-width': 2,
        'circle-stroke-color': isDark ? '#0f172a' : '#ffffff',
      },
    })

    // Обработчик клика на кластер - увеличиваем зум
    const clusterClickHandler = (e: mapboxgl.MapLayerMouseEvent) => {
      const features = map.current!.queryRenderedFeatures(e.point, {
        layers: ['clusters'],
      })
      if (features.length === 0) return

      const clusterId = features[0].properties!.cluster_id
      const source = map.current!.getSource('requests') as GeoJSONSource
      source.getClusterExpansionZoom(clusterId, (err, zoom) => {
        if (err || zoom === null || zoom === undefined) return

        map.current!.easeTo({
          center: (features[0].geometry as any).coordinates,
          zoom: Math.min(zoom, 15),
        })
      })
    }

    // Обработчик клика на отдельную точку - показываем попап
    const pointClickHandler = (e: mapboxgl.MapLayerMouseEvent) => {
      const coordinates = (e.features![0].geometry as any).coordinates.slice()
      const props = e.features![0].properties!

      // Убеждаемся, что попап закрыт
      if (popup.current) {
        popup.current.remove()
      }

      popup.current = new mapboxgl.Popup({ offset: 0, closeButton: false })
        .setLngLat(coordinates as [number, number])
        .setHTML(`
          <div class="glass-panel ${themeClass}" style="border-radius: 12px; padding: 12px 16px; min-width: 180px;">
            <div style="font-weight: 600; font-size: 13px; margin-bottom: 4px;">${props.city || 'Unknown'}</div>
            <div style="font-size: 11px; opacity: 0.7; margin-bottom: 8px;">${props.country || 'Unknown'}</div>
            ${props.ip_address ? `<div style="font-size: 11px; opacity: 0.8; margin-bottom: 4px;">IP: ${props.ip_address}</div>` : ''}
            ${props.hwid ? `<div style="font-size: 10px; opacity: 0.6; margin-bottom: 4px; word-break: break-all;">HWID: ${props.hwid.substring(0, 20)}${props.hwid.length > 20 ? '...' : ''}</div>` : ''}
            ${props.action ? `<div style="font-size: 10px; opacity: 0.6; text-transform: uppercase;">${props.action}</div>` : ''}
          </div>
        `)
        .addTo(map.current!)

      // Закрываем попап при клике на карту
      map.current!.once('click', () => {
        if (popup.current) {
          popup.current.remove()
          popup.current = null
        }
      })
    }

    // Изменяем курсор при наведении
    const clusterMouseEnterHandler = () => {
      map.current!.getCanvas().style.cursor = 'pointer'
    }
    const clusterMouseLeaveHandler = () => {
      map.current!.getCanvas().style.cursor = ''
    }
    const pointMouseEnterHandler = () => {
      map.current!.getCanvas().style.cursor = 'pointer'
    }
    const pointMouseLeaveHandler = () => {
      map.current!.getCanvas().style.cursor = ''
    }

    map.current.on('click', 'clusters', clusterClickHandler)
    map.current.on('click', 'unclustered-point', pointClickHandler)
    map.current.on('mouseenter', 'clusters', clusterMouseEnterHandler)
    map.current.on('mouseleave', 'clusters', clusterMouseLeaveHandler)
    map.current.on('mouseenter', 'unclustered-point', pointMouseEnterHandler)
    map.current.on('mouseleave', 'unclustered-point', pointMouseLeaveHandler)

    // Сохраняем функции для удаления
    eventHandlers.current = [
      () => map.current?.off('click', 'clusters', clusterClickHandler),
      () => map.current?.off('click', 'unclustered-point', pointClickHandler),
      () => map.current?.off('mouseenter', 'clusters', clusterMouseEnterHandler),
      () => map.current?.off('mouseleave', 'clusters', clusterMouseLeaveHandler),
      () => map.current?.off('mouseenter', 'unclustered-point', pointMouseEnterHandler),
      () => map.current?.off('mouseleave', 'unclustered-point', pointMouseLeaveHandler),
    ]
  }, [resolvedTheme])

  // Update map when data changes
  useEffect(() => {
    if (!map.current || !mapData) return

    const points = mapData.points || []
    if (points.length > 0) {
      setupMapLayers(points)
    }
  }, [mapData, setupMapLayers])

  // Track zoom changes
  useEffect(() => {
    if (!map.current) return

    const updateZoom = () => {
      if (map.current) {
        setCurrentZoom(map.current.getZoom())
      }
    }

    map.current.on('zoom', updateZoom)
    updateZoom()

    return () => {
      map.current?.off('zoom', updateZoom)
    }
  }, [map.current])

  useEffect(() => {
    if (!mapContainer.current || !isAuthenticated || !user) return

    if (!map.current) {
      mapboxgl.accessToken = import.meta.env.VITE_MAPBOX_TOKEN || "pk.eyJ1IjoibWFwYm94IiwiYSI6ImNpejY4NXV4NTFiamM2eW5rNGFqZzZ5bWcifQ.rJcFIG214AriISLbB6B5aw"

      const mapStyle = resolvedTheme === "dark"
        ? "mapbox://styles/mapbox/dark-v11"
        : "mapbox://styles/mapbox/light-v11"

      const initialZoom = 3.5

      map.current = new mapboxgl.Map({
        container: mapContainer.current,
        style: mapStyle,
        center: [20, 30],
        zoom: initialZoom,
        minZoom: 2,
        attributionControl: false,
        projection: { name: 'mercator' }
      })

      map.current.once("load", () => {
        map.current?.resize()
        if (mapData?.points && mapData.points.length > 0) {
          setupMapLayers(mapData.points)
        }
      })
    }
  }, [isAuthenticated, user, setupMapLayers, mapData])

  useEffect(() => {
    if (!map.current || !resolvedTheme) return
    const mapStyle = resolvedTheme === "dark" ? "mapbox://styles/mapbox/dark-v11" : "mapbox://styles/mapbox/light-v11"

    // Удаляем старые обработчики событий перед изменением стиля
    eventHandlers.current.forEach(handler => handler())
    eventHandlers.current = []

    if (popup.current) {
      popup.current.remove()
      popup.current = null
    }

    map.current.setStyle(mapStyle)
    map.current.once("style.load", () => {
      if (mapData?.points && mapData.points.length > 0) {
        setupMapLayers(mapData.points)
      }
    })
  }, [resolvedTheme, setupMapLayers, mapData])

  if (!isInitialized) return null
  if (!isAuthenticated || !user) return <AccessDenied isAuthenticated={false} hasAccess={false} user={user} message="Access denied" useCard={true} />

  // --- Float Stats Card Component ---
  const FloatStatsCard = () => {
    const formatValue = (value: number) => {
      if (value >= 1000000) return `${(value / 1000000).toFixed(1)}M`
      if (value >= 1000) return `${(value / 1000).toFixed(1)}k`
      return value.toString()
    }

    const statItems = [
      {
        label: 'Requests',
        value: formatValue(stats.totalRequests),
      },
      {
        label: 'Connections',
        value: formatValue(stats.totalConnections),
      },
      {
        label: 'Keys',
        value: formatValue(stats.totalKeys),
      },
      {
        label: 'Users',
        value: formatValue(stats.totalUsers),
      }
    ]

    return (
      <div className="absolute top-4 left-4 z-10">
        <div className="flex divide-x divide-white/10 backdrop-blur-2xl bg-transparent border border-white/10">
          {statItems.map((stat, index) => (
            <div key={index} className="px-3 py-2 flex flex-col min-w-[100px]">
              <span className="text-[10px] font-semibold tracking-wider text-gray-400 dark:text-gray-400 uppercase mb-1">
                {stat.label}
              </span>
              <span className="text-xl font-bold text-white dark:text-white leading-none">
                {stat.value}
              </span>
            </div>
          ))}
        </div>
      </div>
    )
  }

  // --- Filter Panel Component ---
  const FilterPanel = () => {
    return (
      <div className="absolute top-4 right-4 z-10 flex flex-col gap-2">
        <Button
          onClick={() => setIsFilterOpen(!isFilterOpen)}
          variant="default"
          size="sm"
          className="h-8 text-xs gap-1.5"
        >
          <Filter className="size-3" />
          Filter
          {filterValue && (
            <span className="ml-1 px-1.5 py-0.5 text-[10px] bg-primary-foreground/20 text-primary-foreground rounded-full">
              1
            </span>
          )}
        </Button>

        {isFilterOpen && (
          <Card className="p-3 border rounded-lg bg-background shadow-sm w-64">
            <div className="space-y-2">
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground/60" />
                <Input
                  placeholder="HWID or IP address"
                  value={filterValue}
                  onChange={(e) => setFilterValue(e.target.value)}
                  className="h-8 pl-8 pr-7 text-xs bg-muted/30 border-muted-foreground/20 focus-visible:bg-background"
                  onKeyDown={(e) => {
                    if (e.key === 'Escape') {
                      setIsFilterOpen(false)
                    }
                  }}
                />
                {filterValue && (
                  <button
                    onClick={() => setFilterValue("")}
                    className="absolute right-1.5 top-1/2 -translate-y-1/2 text-muted-foreground/60 hover:text-foreground transition-colors"
                  >
                    <X className="size-3" />
                  </button>
                )}
              </div>
              <p className="text-[10px] text-muted-foreground/70 px-1">
                Enter HWID or IP address to filter
              </p>
            </div>
          </Card>
        )}
      </div>
    )
  }

  return (
    <div className="relative flex-1 w-full h-full min-h-0 rounded-xl overflow-hidden">
      <style>{MAP_STYLES}</style>

      {/* Floating HUD */}
      <FloatStatsCard />

      {/* Filter Panel */}
      <FilterPanel />

      {/* Map */}
      <div
        ref={mapContainer}
        className="absolute inset-0 w-full h-full"
      />
    </div>
  )
}
