import TicketAvatar from 'components/icons/TicketAvatar';

function TaskChip({
  background = 'bluegray',
  taskTitle,
  taskStatus,
  responseDue,
  taskCreator,
  taskNumber,
  createdOn,
}) {
  // Define Tailwind CSS classes for colors and styling
  const responseDueStyles = 'px-2 py-0.5 text-xs border dark:text-yellow-400 dark:border-yellow-400 text-yellow-700 border-yellow-700';

  // Dummy function for handling task clicks
  const handleTaskClick = () => {
    // Your logic here
  };

  const handleKeyPress = (event: React.KeyboardEvent) => {
    if (event.key === 'Enter' || event.key === ' ') {
      handleTaskClick();
    }
  };

  const truncateTitle = (title, wordLimit) => {
    const words = title.split(' ');
    if (words.length > wordLimit) {
      return `${words.slice(0, wordLimit).join(' ')}...`;
    }
    return title;
  };

  const formatDate = (dateString) => {
    const [date] = dateString.split(' '); // Ignore time
    const [year, month, day] = date.split('-');
    return `${day}/${month}/${year}`; // Format as "DD/MM/YYYY"
  };

  // This function returns the status directly from the JSON response
  function getStatusLabel(status) {
    return status || 'Unknown';
  }

  const displayedTitle = truncateTitle(taskTitle, 7);
  const displayedDate = formatDate(createdOn);

  return (
    <div
      className={`flex justify-between items-center px-4 py-2 rounded-lg  ${
        background === 'bluegray' ? 'bg-blueGrey-100' : 'bg-white'
      } dark:bg-navy-700 p-4  text-white my-2 `}
      onClick={handleTaskClick}
      onKeyPress={handleKeyPress}
      role="button"
      tabIndex={0}
    >
      <div className="flex items-center space-x-4">
        <TicketAvatar.Logo />

        <div>
          <p className="border-blueGrey-500 dark:border-blueGrey-400  text-textColor-light dark:text-textColor-dark font-medium ">
            {displayedTitle}
          </p>
          <div className="flex items-center text-xs border-blueGrey-500 dark:border-blueGrey-400 text-blueGrey-500 dark:text-blueGrey-400 font-medium ">
            <span>
              @
              {taskCreator}
            </span>
            {' '}
            {/* Task creator */}
            <span className="mx-1">|</span>
            <span>
              #
              {taskNumber}
            </span>
            {' '}
            {/* Task number */}
            <span className="mx-1">|</span>
            <span>
              Created on
              {displayedDate}
            </span>
            {' '}
            {/* Created date */}
            {responseDue && (
              <span className={`${responseDueStyles} ml-2`}>Response Due</span>
            )}
          </div>
        </div>
        {/* Response Due Tag */}
      </div>

      {/* Right side with "Status:" and status tag */}
      <div className="flex items-center">
        <span className="text-xs mr-1 text-gray-600 ">Status:</span>
        {' '}
        {/* Status label */}
        <p className="text-xs text-blueGrey-500 dark:text-blueGrey-400 font-semibold ">
          {getStatusLabel(taskStatus)}
        </p>
      </div>
    </div>
  );
}

export default TaskChip;
