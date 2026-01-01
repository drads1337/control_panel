"use client"

import { useEffect, useRef, useState } from "react"
import mapboxgl from "mapbox-gl"
import "mapbox-gl/dist/mapbox-gl.css"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Spinner } from "@/components/ui/spinner"
import { enhancedApi as api } from "@/shared/api/enhanced-client"
import { API_ENDPOINTS } from "@/shared/api/config"
import { Globe } from "lucide-react"

interface CountryData {
  country: string
  requests: number
  latitude: number
  longitude: number
}

interface CountriesMapResponse {
  countries: CountryData[]
  total_countries: number
  total_requests: number
}

export function CountriesMap() {
  const mapContainer = useRef<HTMLDivElement>(null)
  const map = useRef<mapboxgl.Map | null>(null)
  const markers = useRef<mapboxgl.Marker[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [data, setData] = useState<CountriesMapResponse | null>(null)

  useEffect(() => {
    // Fetch countries data
    const fetchData = async () => {
      try {
        setLoading(true)
        setError(null)
        const response = await api.get<CountriesMapResponse>(API_ENDPOINTS.DASHBOARD_COUNTRIES_MAP)
        setData(response.data)
      } catch (err) {
        console.error("Error fetching countries map data:", err)
        setError("Failed to load map data")
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [])

  useEffect(() => {
    if (!mapContainer.current || !data || data.countries.length === 0) return

    // Initialize map
    if (!map.current) {
      mapboxgl.accessToken = import.meta.env.VITE_MAPBOX_TOKEN || "pk.eyJ1IjoibWFwYm94IiwiYSI6ImNpejY4NXV4NTFiamM2eW5rNGFqZzZ5bWcifQ.rJcFIG214AriISLbB6B5aw"

      map.current = new mapboxgl.Map({
        container: mapContainer.current,
        style: "mapbox://styles/mapbox/dark-v11",
        center: [0, 20],
        zoom: 1.5,
        attributionControl: false,
      })

      map.current.addControl(new mapboxgl.NavigationControl(), "top-right")
    }

    // Clear existing markers
    markers.current.forEach((marker) => marker.remove())
    markers.current = []

    // Calculate max requests for scaling
    const maxRequests = Math.max(...data.countries.map((c) => c.requests))

    // Add markers for each country
    data.countries.forEach((country) => {
      const el = document.createElement("div")
      el.className = "country-marker"
      
      // Scale marker size based on request count
      const size = Math.max(8, Math.min(30, (country.requests / maxRequests) * 30))
      el.style.width = `${size}px`
      el.style.height = `${size}px`
      el.style.borderRadius = "50%"
      el.style.backgroundColor = "rgba(59, 130, 246, 0.8)"
      el.style.border = "2px solid rgba(59, 130, 246, 1)"
      el.style.cursor = "pointer"
      el.style.transition = "all 0.2s"
      
      el.addEventListener("mouseenter", () => {
        el.style.transform = "scale(1.2)"
        el.style.backgroundColor = "rgba(59, 130, 246, 1)"
      })
      
      el.addEventListener("mouseleave", () => {
        el.style.transform = "scale(1)"
        el.style.backgroundColor = "rgba(59, 130, 246, 0.8)"
      })

      // Create popup
      const popup = new mapboxgl.Popup({ offset: 25, closeOnClick: false })
        .setHTML(`
          <div style="padding: 8px;">
            <div style="font-weight: 600; margin-bottom: 4px;">${country.country}</div>
            <div style="color: #94a3b8; font-size: 12px;">${country.requests.toLocaleString()} requests</div>
          </div>
        `)

      const marker = new mapboxgl.Marker(el)
        .setLngLat([country.longitude, country.latitude])
        .setPopup(popup)
        .addTo(map.current!)

      markers.current.push(marker)
    })

    // Fit map to show all markers
    if (data.countries.length > 0) {
      const bounds = new mapboxgl.LngLatBounds()
      data.countries.forEach((country) => {
        bounds.extend([country.longitude, country.latitude])
      })
      map.current.fitBounds(bounds, {
        padding: { top: 50, bottom: 50, left: 50, right: 50 },
        maxZoom: 5,
      })
    }

    return () => {
      markers.current.forEach((marker) => marker.remove())
      markers.current = []
    }
  }, [data])

  // Cleanup map on unmount
  useEffect(() => {
    return () => {
      if (map.current) {
        map.current.remove()
        map.current = null
      }
      markers.current.forEach((marker) => marker.remove())
      markers.current = []
    }
  }, [])

  if (loading) {
    return (
      <Card className="@container/card p-3">
        <CardHeader className="p-0 pb-1">
          <CardTitle className="text-xl font-semibold">Requests by Country</CardTitle>
          <CardDescription className="text-xs">Geographic distribution of requests</CardDescription>
        </CardHeader>
        <CardContent className="p-0 pt-1">
          <div className="flex flex-col items-center justify-center h-[400px] gap-2">
            <Spinner size="lg" />
            <p className="text-sm text-muted-foreground">Loading map...</p>
          </div>
        </CardContent>
      </Card>
    )
  }

  if (error) {
    return (
      <Card className="@container/card p-3">
        <CardHeader className="p-0 pb-1">
          <CardTitle className="text-xl font-semibold">Requests by Country</CardTitle>
          <CardDescription className="text-xs">Geographic distribution of requests</CardDescription>
        </CardHeader>
        <CardContent className="p-0 pt-1">
          <div className="flex items-center justify-center h-[400px] text-muted-foreground">
            <div className="text-center">
              <Globe className="size-12 mx-auto mb-2 opacity-50" />
              <p>{error}</p>
            </div>
          </div>
        </CardContent>
      </Card>
    )
  }

  if (!data || data.countries.length === 0) {
    return (
      <Card className="@container/card p-3">
        <CardHeader className="p-0 pb-1">
          <CardTitle className="text-xl font-semibold">Requests by Country</CardTitle>
          <CardDescription className="text-xs">Geographic distribution of requests</CardDescription>
        </CardHeader>
        <CardContent className="p-0 pt-1">
          <div className="flex items-center justify-center h-[400px] text-muted-foreground">
            <div className="text-center">
              <Globe className="size-12 mx-auto mb-2 opacity-50" />
              <p>No country data available</p>
            </div>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="@container/card p-3">
      <CardHeader className="p-0 pb-1">
        <CardTitle className="text-xl font-semibold">Requests by Country</CardTitle>
        <CardDescription className="text-xs">
          {data.total_countries} countries • {data.total_requests.toLocaleString()} total requests
        </CardDescription>
      </CardHeader>
      <CardContent className="p-0 pt-1">
        <div
          ref={mapContainer}
          className="w-full h-[400px] rounded-lg overflow-hidden"
          style={{ minHeight: "400px" }}
        />
      </CardContent>
    </Card>
  )
}

