"use client"

import type React from "react"
import { useState, useEffect } from "react"
import { Seat, Bus } from "../types/chat"
import SeatIcon from "./Seaticon"
import { getSeatGender } from "../utils/busUtils"

interface SeatLayoutProps {
  bus: Bus
  selectedSeats: Seat[]
  onSeatSelect?: (seats: Seat[]) => void
  onClose: () => void
}

const SeatLayout: React.FC<SeatLayoutProps> = ({ bus, selectedSeats, onClose }) => {
  const [isLaptop, setIsLaptop] = useState(false)
  const [isVisible, setIsVisible] = useState(false)
  const [isClosing, setIsClosing] = useState(false)

  // Check screen size for responsive behavior
  useEffect(() => {
    const checkScreenSize = () => {
      setIsLaptop(window.innerWidth >= 1024)
    }
    
    checkScreenSize()
    window.addEventListener('resize', checkScreenSize)
    
    return () => window.removeEventListener('resize', checkScreenSize)
  }, [])

  // Animation effect
  useEffect(() => {
    // Trigger animation after component mounts
    const timer = setTimeout(() => setIsVisible(true), 10)
    return () => clearTimeout(timer)
  }, [])

  // Handle click outside to close
  const handleOverlayClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      handleClose()
    }
  }

  // Handle close with animation
  const handleClose = () => {
    if (isClosing) return // Prevent multiple close calls
    setIsClosing(true)
    setIsVisible(false)
    // Wait for animation to complete before calling onClose
    setTimeout(() => onClose(), 300)
  }
  // Colors for seat layout (matching bus card colors)
  const Colors = {
    neutralGreyDisable: "#9ca3af",
    neutralGreyBg: "#f3f4f6",
    green300: "#10b981",
    yellow300: "#FDE047", // Tailwind yellow-300
    pink300: "#F9A8D4",   // Tailwind pink-300
  }





  // Generate vertical seat layout with sequential numbering starting from right
  // All seats are shown as available - only recommended seats will be highlighted
  const generateVerticalSeatLayout = () => {
    return [
      // Row 1: Seats 1, 2, 3, 4
      [
        { id: 4, number: "4", available: true },
        { id: 3, number: "3", available: true },
        null, // aisle
        { id: 2, number: "2", available: true },
        { id: 1, number: "1", available: true },
      ],
      // Row 2: Seats 5, 6, 7, 8
      [
        { id: 8, number: "8", available: true },
        { id: 7, number: "7", available: true },
        null, // aisle
        { id: 6, number: "6", available: true },
        { id: 5, number: "5", available: true },
      ],
      // Row 3: Seats 9, 10, 11, 12
      [
        { id: 12, number: "12", available: true },
        { id: 11, number: "11", available: true },
        null, // aisle
        { id: 10, number: "10", available: true },
        { id: 9, number: "9", available: true },
      ],
      // Row 4: Seats 13, 14, 15, 16
      [
        { id: 16, number: "16", available: true },
        { id: 15, number: "15", available: true },
        null, // aisle
        { id: 14, number: "14", available: true },
        { id: 13, number: "13", available: true },
      ],
      // Row 5: Seats 17, 18, 19, 20
      [
        { id: 20, number: "20", available: true },
        { id: 19, number: "19", available: true },
        null, // aisle
        { id: 18, number: "18", available: true },
        { id: 17, number: "17", available: true },
      ],
      // Row 6: Seats 21, 22, 23, 24
      [
        { id: 24, number: "24", available: true },
        { id: 23, number: "23", available: true },
        null, // aisle
        { id: 22, number: "22", available: true },
        { id: 21, number: "21", available: true },
      ],
      // Row 7: Seats 25, 26, 27, 28
      [
        { id: 28, number: "28", available: true },
        { id: 27, number: "27", available: true },
        null, // aisle
        { id: 26, number: "26", available: true },
        { id: 25, number: "25", available: true },
      ],
      // Row 8: Seats 29, 30, 31, 32
      [
        { id: 32, number: "32", available: true },
        { id: 31, number: "31", available: true },
        null, // aisle
        { id: 30, number: "30", available: true },
        { id: 29, number: "29", available: true },
      ],
      // Row 9: Seats 33, 34, 35, 36
      [
        { id: 36, number: "36", available: true },
        { id: 35, number: "35", available: true },
        null, // aisle
        { id: 34, number: "34", available: true },
        { id: 33, number: "33", available: true },
      ],
      // Extra legroom space
      null,
      // Row 10: Seats 37, 38, 39, 40
      [
        { id: 40, number: "40", available: true },
        { id: 39, number: "39", available: true },
        null, // aisle
        { id: 38, number: "38", available: true },
        { id: 37, number: "37", available: true },
      ],
      // Row 11 (Non-recliner section): Seats 41, 42, 43, 44, 45
      [
        { id: 45, number: "45", available: true },
        { id: 44, number: "44", available: true },
        { id: 43, number: "43", available: true },
        { id: 42, number: "42", available: true },
        { id: 41, number: "41", available: true },
      ],
    ]
  }

  const seatRows = generateVerticalSeatLayout()

  const getSeatProps = (seat: any) => {
    if (!seat) return {}


    // Check if this seat is in the selectedSeats (recommended seats from bus card)
    const isRecommendedSeat = selectedSeats.some(selectedSeat => 
      selectedSeat.seat_number.toString() === seat.number.toString() || selectedSeat.seat_id === seat.id
    )

    if (isRecommendedSeat) {
      // Find the corresponding seat in selectedSeats to get its gender assignment
      const selectedSeat = selectedSeats.find(selectedSeat => 
        selectedSeat.seat_number.toString() === seat.number.toString() || selectedSeat.seat_id === seat.id
      )
      
      if (selectedSeat) {
        // Get gender assignment from bus data
        const seatGender = getSeatGender(bus, selectedSeat)
        
        if (seatGender === "female") {
          return {
            bgColor: Colors.pink300, // Pink for female recommended
            strokeColor: "#ec4899", // Pink border
          }
        } else {
          return {
            bgColor: Colors.yellow300, // Yellow for male recommended
            strokeColor: "#eab308", // Yellow border
          }
        }
      }
    }

    // All seats (including non-recliner) - light grey (not recommended)
    return {
      bgColor: "#e5e7eb", // light grey background
      strokeColor: "#9ca3af", // grey border
    }
  }

  return (
    <div
      onClick={handleOverlayClick}
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 9999,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "transparent", // Remove dark overlay
        padding: isLaptop ? "0 80px 0 0" : "0", // Add 80px gap from right edge on laptop
        opacity: isVisible ? 1 : 0,
        transition: "opacity 0.3s ease-in-out",
      }}
    >
      <div
        style={{
          backgroundColor: "white",
          borderRadius: "12px",
          boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.25)",
          width: "fit-content",
          maxHeight: "90vh",
          overflowY: "auto",
          border: "2px solid #e5e7eb",
          backdropFilter: "blur(2px)",
          // Position towards right on laptop with margin
          marginLeft: isLaptop ? "auto" : "0",
          marginRight: isLaptop ? "0" : "0",
          // Smooth animation styles
          transform: isVisible 
            ? "translateX(0) scale(1)" 
            : isLaptop 
              ? "translateX(100px) scale(0.95)" 
              : "translateY(50px) scale(0.95)",
          transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
          opacity: isVisible ? 1 : 0,
        }}
      >
        {/* Header with close button */}
        <div
          style={{
            display: "flex",
            justifyContent: "flex-end",
            opacity: isVisible ? 1 : 0,
            transform: isVisible ? "translateY(0)" : "translateY(-10px)",
            transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1) 0.05s",
          }}
        >
          <button
            onClick={handleClose}
            style={{
              color: "#6b7280",
              fontSize: "24px",
              fontWeight: "bold",
              width: "32px",
              height: "32px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              borderRadius: "50%",
              border: "none",
              backgroundColor: "transparent",
              cursor: "pointer",
              transition: "all 0.2s ease",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = "#f3f4f6"
              e.currentTarget.style.color = "#374151"
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = "transparent"
              e.currentTarget.style.color = "#6b7280"
            }}
          >
            ×
          </button>
        </div>

        {/* Seat Layout */}
        <div 
          style={{ 
            padding: "0 24px 24px 24px",
            opacity: isVisible ? 1 : 0,
            transform: isVisible ? "translateY(0)" : "translateY(20px)",
            transition: "all 0.4s cubic-bezier(0.4, 0, 0.2, 1) 0.1s", // Slight delay for stagger effect
          }}
        >
          {/* Vertical seat grid */}
          <div
            style={{
              backgroundColor: "#f9fafb",
              padding: "32px",
              borderRadius: "16px",
              position: "relative",
              border: "1px solid #e5e7eb",
            }}
          >
            {/* Steering wheel positioned inside the box above seat 1 */}
            <div
              style={{
                position: "absolute",
                top: "10px",
                right: "32px",
                width: "30px",
                height: "30px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <img
                src="https://hebbkx1anhila5yf.public.blob.vercel-storage.com/image-qKHaKjHQpLOsaxyBRMWHv8cr1h3MIZ.png"
                alt="steering"
                style={{ width: "30px", height: "30px" }}
              />
            </div>

            <div style={{ display: "flex", flexDirection: "column", marginTop: "20px" }}>
              {seatRows.map((row, rowIndex) => {
                if (row === null) {
                  // Extra legroom space
                  return (
                    <div
                      key={`legroom-${rowIndex}`}
                      style={{
                        display: "flex",
                        justifyContent: "center",
                        alignItems: "center",
                        position: "relative",
                        borderTop: "2px dashed #10b981",
                        borderBottom: "2px dashed #10b981",
                        margin: "10px 0",
                      }}
                    >
                      <div
                        style={{
                          color: "#10b981",
                          fontSize: "12px",
                          fontWeight: "500",
                          backgroundColor: "white",
                          padding: "4px 8px",
                          borderRadius: "4px",
                        }}
                      >
                        Extra Legroom Space
                      </div>
                    </div>
                  )
                }

                // Check if this is the non-recliner row (seats 41-45)
                const isNonReclinerRow = row.some(seat => 
                  seat && parseInt(seat.number) >= 41 && parseInt(seat.number) <= 45
                )

                return (
                  <div
                    key={rowIndex}
                    style={{
                      display: "flex",
                      justifyContent: "center",
                      alignItems: "center",
                      gap: isNonReclinerRow ? "8px" : "6px", 
                    }}
                  >
                    {row.map((seat, seatIndex) => (
                      <div key={seatIndex} style={{ display: "flex", justifyContent: "center", position: "relative" }}>
                        {seat ? (
                          <div style={{ position: "relative", display: "flex", justifyContent: "center", alignItems: "center" }}>
                            <SeatIcon {...getSeatProps(seat)} size={24} />
                            <div
                              style={{
                                position: "absolute",
                                fontSize: "8px",
                                fontWeight: "700",
                                color: "#374151",
                                top: "50%",
                                left: "50%",
                                transform: "translate(-50%, -50%)",
                                zIndex: 10,
                              }}
                            >
                              {seat.number}
                            </div>
                          </div>
                        ) : (
                          <div
                            style={{
                              width: "32px",
                              height: "32px",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                            }}
                          >
                            {/* Just empty space - no aisle indicator */}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )
              })}
            </div>

            {/* Non-recliner section indicator */}
            <div
              style={{
                display: "flex",
                justifyContent: "center",
                marginTop: "16px",
                alignItems: "center",
                gap: "8px",
                backgroundColor: "#dbeafe",
                padding: "8px 16px",
                borderRadius: "8px",
                border: "1px solid #3b82f6",
              }}
            >
              <div
                style={{
                  width: "8px",
                  height: "8px",
                  backgroundColor: "#3b82f6",
                  borderRadius: "50%",
                }}
              ></div>
              <span
                style={{
                  color: "#3b82f6",
                  fontSize: "12px",
                  fontWeight: "600",
                }}
              >
                Non-Recliner Seats (41-45)
              </span>
              <div
                style={{
                  width: "8px",
                  height: "8px",
                  backgroundColor: "#3b82f6",
                  borderRadius: "50%",
                }}
              ></div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default SeatLayout
