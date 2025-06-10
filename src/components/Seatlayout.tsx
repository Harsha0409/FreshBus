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
      className={`fixed inset-0 z-[9999] flex items-center justify-center bg-transparent transition-opacity duration-300 ease-in-out ${
        isLaptop ? 'pr-20' : 'p-0'
      } ${isVisible ? 'opacity-100' : 'opacity-0'}`}
    >
      <div
        className={`bg-white rounded-xl shadow-2xl border-2 border-gray-200 backdrop-blur-sm max-h-[90vh] overflow-y-auto transition-all duration-300 cubic-bezier(0.4, 0, 0.2, 1) ${
          isLaptop ? 'ml-auto mr-0' : 'ml-0 mr-0'
        } ${
          isVisible 
            ? 'translate-x-0 scale-100 opacity-100' 
            : isLaptop 
              ? 'translate-x-[100px] scale-95 opacity-0' 
              : 'translate-y-[50px] scale-95 opacity-0'
        }`}
        style={{ width: "fit-content" }}
      >
        <div 
          className={`transition-all duration-400 cubic-bezier(0.4, 0, 0.2, 1) delay-100 ${
            isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-5'
          }`}
        >
          {/* Vertical seat grid */}
          <div className="bg-gray-50 p-6 rounded-2xl relative border border-gray-200">
            {/* Steering wheel and close button container */}
            <div className="absolute top-2 right-6 flex items-center gap-2">
              <img
                src="https://hebbkx1anhila5yf.public.blob.vercel-storage.com/image-qKHaKjHQpLOsaxyBRMWHv8cr1h3MIZ.png"
                alt="steering"
                className="w-6 h-6"
              />
              <button
                onClick={handleClose}
                className="text-gray-500 text-xl font-bold w-6 h-6 flex items-center justify-center rounded-full border-none bg-transparent cursor-pointer transition-all duration-200 ease-in-out hover:bg-gray-100 hover:text-gray-700"
              >
                ×
              </button>
            </div>

            <div className="flex flex-col mt-5">
              {seatRows.map((row, rowIndex) => {
                if (row === null) {
                  // Extra legroom space
                  return (
                    <div
                      key={`legroom-${rowIndex}`}
                      className="flex justify-center items-center relative border-t-2 border-b-2 border-dashed border-emerald-500 my-2.5"
                    >
                      <div className="text-emerald-500 text-xs font-medium bg-white px-2 py-1 rounded">
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
                    className={`flex justify-center items-center ${
                      isNonReclinerRow ? 'gap-2' : 'gap-1.5'
                    }`}
                  >
                    {row.map((seat, seatIndex) => (
                      <div key={seatIndex} className="flex justify-center relative">
                        {seat ? (
                          <div className="relative flex justify-center items-center">
                            <SeatIcon {...getSeatProps(seat)} size={24} />
                            <div className="absolute text-[8px] font-bold text-gray-700 top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-10">
                              {seat.number}
                            </div>
                          </div>
                        ) : (
                          <div className="w-8 h-8 flex items-center justify-center">
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
            <div className="flex justify-center mt-2 items-center gap-2 bg-blue-50 px-4 py-2 rounded-lg border border-blue-500">
              <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
              <span className="text-blue-500 text-xs font-semibold">
                Non-Recliner Seats (41-45)
              </span>
              <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default SeatLayout