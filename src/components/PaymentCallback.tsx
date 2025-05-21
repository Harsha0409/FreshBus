import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';



// Add interface for passenger items
interface Passenger {
  name: string;
  age: number | string;
  gender: string;
  seat: string | number;
}

function PaymentCallback() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [processingStatus, setProcessingStatus] = useState('Processing payment...');
  const [retryCount, setRetryCount] = useState(0);
  const MAX_RETRIES = 5; // Maximum number of retries for pending payments

  useEffect(() => {
    const sessionId = searchParams.get('session_id');
    const status = searchParams.get('status');

    // For debugging
    console.log('Payment callback params:', { sessionId, status });
    console.log('All search params:', Object.fromEntries([...searchParams]));

    // Get access token
    const accessToken = localStorage.getItem('access_token');

    async function processPayment() {
      try {
        setProcessingStatus('Verifying payment status...');

        if (!sessionId) {
          throw new Error('Session ID is missing from the callback URL');
        }

        // Get order_id from localStorage
        const apiOrderId = localStorage.getItem('current_order_id');
        console.log('API Order ID from localStorage:', apiOrderId);

        if (!apiOrderId) {
          throw new Error('API Order ID not found. The booking may not have been completed properly.');
        }

        // For debugging
        console.log('Using API Order ID for confirmation:', apiOrderId);

        // 1. Confirm payment
        setProcessingStatus(
          `Confirming payment... ${retryCount > 0 ? `(Attempt ${retryCount + 1}/${MAX_RETRIES})` : ''}`
        );
        const confirmResp = await fetch(
          `/api/tickets/${apiOrderId}/confirm_payment`,
          {
            method: 'GET',
            headers: {
              Authorization: `Bearer ${accessToken}`,
              'Content-Type': 'application/json',
            },
          }
        );

        console.log('Confirm payment status:', confirmResp.status);

        if (!confirmResp.ok) {
          const errorText = await confirmResp.text();
          console.error('Confirm payment error:', errorText);
          throw new Error(`Payment confirmation failed: ${confirmResp.status}`);
        }

        const confirmData = await confirmResp.json();
        console.log('Confirm payment data:', confirmData);

        // Check payment status
        if (confirmData.status === 2) {
          // Payment is still pending
          if (retryCount < MAX_RETRIES) {
            setProcessingStatus(
              `Payment is being processed. Checking again in 3 seconds... (${retryCount + 1}/${MAX_RETRIES})`
            );
            setRetryCount((prev) => prev + 1);
            setTimeout(processPayment, 3000); // Retry after 3 seconds
            return;
          } else {
            // Max retries reached
            localStorage.setItem(
              'paymentStatus',
              JSON.stringify({
                sessionId,
                summary: `⏳ Payment is still being processed. Please check your bookings later or contact support.`,
              })
            );
            setProcessingStatus('Payment processing. Redirecting...');
            setTimeout(() => {
              if (sessionId) {
                navigate(`/c/${sessionId}`);
              } else {
                navigate('/');
              }
            }, 1500);
            return;
          }
        } else if (confirmData.status !== 1) {
          // Payment failed or unknown status
          localStorage.setItem(
            'paymentStatus',
            JSON.stringify({
              sessionId,
              summary: `❌ Payment failed with status: ${confirmData.status}. Please try again or contact support.`,
            })
          );
          setProcessingStatus('Payment failed. Redirecting...');
          setTimeout(() => {
            if (sessionId) {
              navigate(`/c/${sessionId}`);
            } else {
              navigate('/');
            }
          }, 1500);
          return;
        }

        // If we get here, payment was successful (status === 1)
        if (confirmData.ticket && confirmData.ticket.detailsId) {
          const detailsId = confirmData.ticket.detailsId;
          console.log('Details ID for ticket details:', detailsId);

          // 2. Get ticket details with the detailsId
          setProcessingStatus('Retrieving ticket details...');
          const detailsResp = await fetch(
            `/api/tickets/${detailsId}/ticket_details`,
            {
              method: 'GET',
              headers: {
                Authorization: `Bearer ${accessToken}`,
                'Content-Type': 'application/json',
              },
            }
          );

          console.log('Ticket details status:', detailsResp.status);

          if (!detailsResp.ok) {
            const errorText = await detailsResp.text();
            console.error('Ticket details error:', errorText);
          }

          const detailsData = await detailsResp.json();
          console.log('Ticket details data:', detailsData);

          // 3. Format a clean summary
          const ticket = detailsData.ticketData;
          const passengers = detailsData.passengerData || [];

          // Format times
          const formatTime = (iso: string) =>
            new Date(iso).toLocaleString('en-IN', {
              dateStyle: 'medium',
              timeStyle: 'short',
            });



          // Create a more attractive summary with all booked seats
          const summary = `
🎫 *TICKET CONFIRMED* 🎫

🎉 *Congratulations ${(passengers[0]?.name) || 'Traveler'}!* 🎉
Your bus booking has been successfully confirmed.

📋 *BOOKING DETAILS*
------------------------
🔢 *PNR*: ${ticket.invoiceNumber}
🚌 *Route*: ${ticket.source} ➡️ ${ticket.destination}
⏰ *Journey Date*: ${new Date(ticket.boardingTime).toLocaleDateString('en-IN', {dateStyle: 'full'})}

🚏 *BOARDING*
${ticket.boardingPoint}
${formatTime(ticket.boardingTime)}

🏁 *DESTINATION*
${ticket.droppingPoint}
${formatTime(ticket.droppingTime)}

👥 *PASSENGER DETAILS*
${detailsData.passengerData?.map((pass: Passenger) => 
  `• *${pass.name}* (${pass.age}, ${pass.gender})
   Seat: *${pass.seat}*`
).join('\n') || '• No passenger details available'}



Have a safe and comfortable journey! 🚀
`;


          // 4. Store for chat to pick up
          localStorage.setItem('paymentStatus', JSON.stringify({ sessionId, summary }));

          // Clean up the order ID as it's no longer needed
          localStorage.removeItem('current_order_id');

          setProcessingStatus('Payment successful! Redirecting to chat...');
        } else {
          // Payment confirmed but ticket details missing
          console.error('Invalid confirm_payment response:', confirmData);
          localStorage.setItem(
            'paymentStatus',
            JSON.stringify({
              sessionId,
              summary:
                '❌ Booking failed: Could not retrieve ticket details. Your payment may still be processing.',
            })
          );
          setProcessingStatus('Warning: Ticket details not found. Redirecting...');
        }
      } catch (error: unknown) {
        console.error('Payment callback error:', error);
        let errorMessage = 'Unknown error occurred';

        if (error instanceof Error) {
          errorMessage = error.message;
        }

        localStorage.setItem(
          'paymentStatus',
          JSON.stringify({
            sessionId,
            summary: `❌ Booking failed: ${errorMessage}. If your payment was successful, please contact support.`,
          })
        );
        setProcessingStatus('Error processing payment. Redirecting...');
      }

      // Redirect to chat after short delay
      setTimeout(() => {
        if (sessionId) {
          navigate(`/c/${sessionId}`);
        } else {
          navigate('/');
        }
      }, 1500);
    }

    processPayment();
    // eslint-disable-next-line
  }, [navigate, retryCount]);

  return (
    <div className="flex flex-col items-center justify-center h-screen bg-gray-50 dark:bg-gray-900 p-4">
      <div className="animate-pulse mb-4">
        <svg
          className="w-16 h-16 text-blue-500 dark:text-blue-400"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M13 10V3L4 14h7v7l9-11h-7z"
          />
        </svg>
      </div>
      <h1 className="text-xl font-bold text-gray-800 dark:text-white mb-2">Payment Processing</h1>
      <p className="text-gray-600 dark:text-gray-300 text-center">{processingStatus}</p>
      <p className="text-sm text-gray-500 dark:text-gray-400 mt-8">Please do not close this window.</p>
    </div>
  );
}

export default PaymentCallback;