export const styles = {
  modal: {
    width: '269px',
    height: '103.26px',
    borderRadius: '9.65px',
    border: '1px solid #D9D9E0',
    paddingTop: '14.48px',
    paddingRight: '19.3px',
    paddingBottom: '14.48px',
    paddingLeft: '19.3px',
    boxShadow: '0px 8px 40px 0px rgba(0, 0, 0, 0.1), 0px 12px 32px -16px rgba(0, 0, 0, 0.15)',
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '12.06px'
  },
  dotsIconContainer: {
    position: 'absolute' as const,
    top: '5px',
    left: '5px'
  },
  callerInfoSection: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    marginLeft: '20px'
  },
  callerIdBox: {
    width: '32px',
    height: '32px',
    backgroundColor: '#5B5BD6',
    borderRadius: '6px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: 'white',
    fontWeight: 'bold' as const,
    fontSize: '14px'
  },
  callerNumberContainer: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '2px'
  },
  callerNumber: {
    fontSize: '16px',
    fontWeight: '600' as const,
    color: '#333333',
    lineHeight: '1.2'
  },
  callingText: {
    fontSize: '12px',
    color: '#666666',
    lineHeight: '1.2'
  },
  actionButtonsContainer: {
    display: 'flex',
    gap: '8px',
    marginTop: 'auto'
  },
  acceptButton: {
    flex: 1,
    height: '32px',
    backgroundColor: '#5B5BD6',
    color: 'white',
    border: 'none',
    borderRadius: '6px',
    fontSize: '14px',
    fontWeight: '500' as const,
    cursor: 'pointer',
    transition: 'background-color 0.2s'
  },
  rejectButton: {
    flex: 1,
    height: '32px',
    backgroundColor: 'white',
    color: '#dc3545',
    border: '1px solid #dc3545',
    borderRadius: '6px',
    fontSize: '14px',
    fontWeight: '500' as const,
    cursor: 'pointer',
    transition: 'all 0.2s'
  },
} as const;
