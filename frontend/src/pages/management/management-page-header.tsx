import React from 'react'

export function ManagementPageHeader() {
  return (
    <div className="mb-3 xs:mb-4 sm:mb-5 md:mb-6">
      <h1 className="text-xl xs:text-2xl sm:text-2xl md:text-3xl font-bold tracking-tight text-foreground leading-tight">System Management</h1>
      <p className="text-xs xs:text-sm sm:text-sm md:text-base text-muted-foreground mt-1 xs:mt-1.5 sm:mt-2 leading-snug">
        Comprehensive management of licenses, products, files, and agents.
      </p>
    </div>
  )
}
