import React, { useMemo, useCallback, useState } from 'react'
import Map from 'react-map-gl/mapbox'
import { Marker, Popup } from 'react-map-gl/mapbox'
import 'mapbox-gl/dist/mapbox-gl.css'
import { countryNameToISO, getCountryCoordinates } from '@/lib/country-utils'
import type { DashboardData } from '@/features/dashboard/hooks/use-dashboard-stats'
import type { OwnerDashboardStats } from '@/features/dashboard/hooks/use-owner-dashboard'
import { Card, CardContent } from '@/components/ui/card'
import { Globe } from 'lucide-react'

interface CountriesMapProps {
  data?: DashboardData | OwnerDashboardStats | null
  height?: number
}

interface CountryData {
  isoCode: string
  name: string
  requests: number
  coordinates: [number, number]
}

export function CountriesMap({ data, height = 400 }: CountriesMapProps) {
  const [popupInfo, setPopupInfo] = useState<{ country: CountryData; lngLat: [number, number] } | null>(null)

  // Get Mapbox token from environment variable
  const mapboxToken = import.meta.env.VITE_MAPBOX_TOKEN || ''

  // Process country data
  const countryData = useMemo(() => {
    const topCountries = (data as any)?.top_countries || []
    const processed: CountryData[] = []
    const maxRequests = Math.max(...topCountries.map((c: any) => c.requests || 0), 1)

    topCountries.forEach((item: { country: string; requests: number }) => {
      const isoCode = countryNameToISO(item.country)
      if (isoCode) {
        const coordinates = getCountryCoordinates(isoCode)
        if (coordinates) {
          processed.push({
            isoCode,
            name: item.country,
            requests: item.requests,
            coordinates,
          })
        }
      }
    })

    return processed.sort((a, b) => b.requests - a.requests)
  }, [data])

  // Calculate marker size based on request count
  const getMarkerSize = useCallback((requests: number, maxRequests: number) => {
    const minSize = 6
    const maxSize = 30
    const ratio = requests / maxRequests
    return minSize + (maxSize - minSize) * Math.sqrt(ratio)
  }, [])

  const maxRequests = useMemo(() => {
    return Math.max(...countryData.map(c => c.requests), 1)
  }, [countryData])

  // Calculate center of all countries or default to world center
  const centerLng = countryData.length > 0 
    ? countryData.reduce((sum, c) => sum + c.coordinates[0], 0) / countryData.length
    : 0
  const centerLat = countryData.length > 0
    ? countryData.reduce((sum, c) => sum + c.coordinates[1], 0) / countryData.length
    : 20

  if (!mapboxToken) {
    return (
      <div className="flex items-center justify-center h-full bg-muted/30 rounded-lg border border-dashed" style={{ height }}>
        <div className="text-center p-6">
          <Globe className="h-8 w-8 mx-auto mb-2 text-muted-foreground opacity-50" />
          <p className="text-sm text-muted-foreground mb-2">
            Mapbox token not configured
          </p>
          <p className="text-xs text-muted-foreground">
            Please set VITE_MAPBOX_TOKEN in your environment variables
          </p>
        </div>
      </div>
    )
  }

  if (countryData.length === 0) {
    return (
      <div className="w-full rounded-lg overflow-hidden border bg-background relative" style={{ height }}>
        <Map
          mapboxAccessToken={mapboxToken}
          initialViewState={{
            longitude: centerLng,
            latitude: centerLat,
            zoom: 1.5,
          }}
          style={{ width: '100%', height: '100%' }}
          mapStyle="mapbox://styles/mapbox/light-v11"
        />
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10">
          <div className="bg-background/90 backdrop-blur-sm rounded-lg p-4 border shadow-lg">
            <Globe className="h-6 w-6 mx-auto mb-2 text-muted-foreground opacity-50" />
            <p className="text-sm text-muted-foreground text-center font-medium">
              No country data available
            </p>
            <p className="text-xs text-muted-foreground text-center mt-1">
              Country statistics will appear here once requests are made
            </p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="w-full rounded-lg overflow-hidden border bg-background relative" style={{ height }}>
      <Map
        mapboxAccessToken={mapboxToken}
        initialViewState={{
          longitude: centerLng,
          latitude: centerLat,
          zoom: 1.5,
        }}
        style={{ width: '100%', height: '100%' }}
        mapStyle="mapbox://styles/mapbox/light-v11"
      >
        {countryData.map((country) => {
          const markerSize = getMarkerSize(country.requests, maxRequests)
          const intensity = country.requests / maxRequests
          
          return (
            <Marker
              key={country.isoCode}
              longitude={country.coordinates[0]}
              latitude={country.coordinates[1]}
            >
              <div
                className="cursor-pointer transition-all hover:scale-110"
                onClick={() => {
                  setPopupInfo({
                    country,
                    lngLat: country.coordinates,
                  })
                }}
                style={{
                  width: markerSize,
                  height: markerSize,
                  borderRadius: '50%',
                  backgroundColor: `rgba(59, 130, 246, ${0.3 + intensity * 0.7})`,
                  border: `2px solid rgba(59, 130, 246, ${0.5 + intensity * 0.5})`,
                  boxShadow: `0 0 ${markerSize / 2}px rgba(59, 130, 246, ${0.5})`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <div
                  className="rounded-full"
                  style={{
                    width: markerSize * 0.6,
                    height: markerSize * 0.6,
                    backgroundColor: 'rgba(59, 130, 246, 0.8)',
                  }}
                />
              </div>
            </Marker>
          )
        })}

        {popupInfo && (
          <Popup
            anchor="bottom"
            longitude={popupInfo.lngLat[0]}
            latitude={popupInfo.lngLat[1]}
            onClose={() => setPopupInfo(null)}
            closeOnClick={false}
            className="mapbox-popup"
          >
            <div className="p-2 min-w-[120px]">
              <div className="font-semibold text-sm mb-1">
                {popupInfo.country.name}
              </div>
              <div className="text-xs text-muted-foreground">
                {popupInfo.country.requests.toLocaleString()} requests
              </div>
            </div>
          </Popup>
        )}
      </Map>
    </div>
  )
}